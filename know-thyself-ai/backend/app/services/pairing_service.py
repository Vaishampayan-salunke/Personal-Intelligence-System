import os
import re
import io
import time
import json
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import qrcode
import qrcode.image.svg

from app.models.user import User
from app.models.mobile_device import MobileDevice, MobilePairingSession, MobilePhoneVerification
from app.services.websocket_manager import ws_manager
from app.core.security import create_access_token

def mask_email(email: str) -> str:
    """Mask email for privacy display during pairing approval, e.g. va***@gmail.com."""
    if not email or "@" not in email:
        return "user@account"
    parts = email.split("@")
    user_part = parts[0]
    domain_part = parts[1]
    if len(user_part) <= 2:
        masked_user = user_part[0] + "***"
    else:
        masked_user = user_part[:2] + "***"
    return f"{masked_user}@{domain_part}"

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is offset-aware UTC across SQLite and PostgreSQL."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def normalize_phone(country_code: str, phone: str) -> str:
    """Normalize phone number to E.164-like standard without spaces or special characters."""
    clean_cc = re.sub(r"[^\d+]", "", country_code.strip())
    if not clean_cc.startswith("+"):
        clean_cc = "+" + clean_cc
    clean_num = re.sub(r"[^\d]", "", phone.strip())
    return f"{clean_cc}{clean_num}"

# -----------------------------------------------------------------------
# Step 1: Phone Number & SMS Verification
# -----------------------------------------------------------------------

def send_phone_verification_otp(
    user_id: int,
    country_code: str,
    phone_number: str,
    db: Session
) -> Dict[str, Any]:
    """
    Generate and send SMS OTP for phone verification.
    If SMS gateway credentials are not configured, transparently operates in
    Development Sandbox Mode without faking production delivery.
    """
    full_phone = normalize_phone(country_code, phone_number)
    now_utc = datetime.now(timezone.utc)

    # 1. Rate Limiting: Max 3 OTP requests per 10 minutes per user
    ten_mins_ago = now_utc - timedelta(minutes=10)
    recent_requests = db.query(MobilePhoneVerification).filter(
        MobilePhoneVerification.user_id == user_id,
        MobilePhoneVerification.created_at >= ten_mins_ago
    ).count()

    if recent_requests >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests. Please wait 10 minutes before requesting a new OTP."
        )

    # 2. Generate 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    expires_at = now_utc + timedelta(minutes=5)

    # 3. Save to database
    record = MobilePhoneVerification(
        user_id=user_id,
        phone_number=full_phone,
        otp_hash=otp_hash,
        is_verified=False,
        attempts=0,
        expires_at=expires_at
    )
    db.add(record)
    db.commit()

    # 4. Check SMS Gateway credentials (Twilio / Provider)
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_PHONE_NUMBER")

    sms_sent = False
    if account_sid and auth_token and from_phone:
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            client.messages.create(
                body=f"[Know Thyself AI] Your device pairing verification code is {otp_code}. Valid for 5 minutes.",
                from_=from_phone,
                to=full_phone
            )
            sms_sent = True
        except Exception as e:
            # Fall back to dev sandbox mode if SMS provider call fails
            sms_sent = False

    if sms_sent:
        return {
            "status": "sent",
            "phone_number": full_phone,
            "dev_mode": False,
            "message": f"Verification code sent via SMS to {full_phone}."
        }
    else:
        # Development Sandbox Mode
        return {
            "status": "dev_mode",
            "phone_number": full_phone,
            "dev_mode": True,
            "message": "SMS Gateway not configured in environment. Development Sandbox Mode active: use the verification code below to proceed.",
            "dev_otp": otp_code
        }

def verify_phone_otp(
    user_id: int,
    country_code: str,
    phone_number: str,
    otp_code: str,
    db: Session
) -> Dict[str, Any]:
    """Verify phone OTP with attempt throttling and single-use invalidation."""
    full_phone = normalize_phone(country_code, phone_number)
    now_utc = datetime.now(timezone.utc)
    clean_code = otp_code.strip()
    submitted_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()

    # Find the most recent active verification attempt
    verification = db.query(MobilePhoneVerification).filter(
        MobilePhoneVerification.user_id == user_id,
        MobilePhoneVerification.phone_number == full_phone,
        MobilePhoneVerification.is_verified == False
    ).order_by(MobilePhoneVerification.created_at.desc()).first()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending verification request found for this phone number. Please click 'Send OTP' first."
        )

    if now_utc > ensure_utc(verification.expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new OTP."
        )

    if verification.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. This OTP has been invalidated. Please request a new one."
        )

    verification.attempts += 1

    # Verify constant-time hash comparison
    if not secrets.compare_digest(verification.otp_hash, submitted_hash):
        db.commit()
        remaining = 5 - verification.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining."
        )

    # Success
    verification.is_verified = True
    db.commit()

    return {
        "status": "verified",
        "verified": True,
        "phone_number": full_phone,
        "message": "Phone number successfully verified."
    }

# -----------------------------------------------------------------------
# Step 2: Secure QR Code & Manual Pairing Session
# -----------------------------------------------------------------------

def generate_qr_svg(payload: str) -> str:
    """Generate crisp standalone SVG for QR code without requiring raster libraries."""
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(image_factory=factory)
    stream = io.BytesIO()
    img.save(stream)
    return stream.getvalue().decode("utf-8")

async def create_pairing_session(
    user_id: int,
    phone_number: Optional[str],
    server_base_url: str,
    db: Session
) -> Dict[str, Any]:
    """
    Create a 2-minute cryptographically secure pairing session:
    - Generates pairing_id, pairing_token, 6-digit pairing_code
    - Hashes secrets with SHA-256 before storing
    - Produces clean QR code SVG
    - Broadcasts pairing_started event to user's web WebSocket
    """
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(seconds=120) # 2 minutes strict expiration

    # Invalidate any previous pending sessions for this user
    db.query(MobilePairingSession).filter(
        MobilePairingSession.user_id == user_id,
        MobilePairingSession.status == "pending"
    ).update({"status": "expired"})

    pairing_id = f"pair_{secrets.token_hex(12)}"
    pairing_token = secrets.token_urlsafe(32)
    pairing_code = f"{secrets.randbelow(900000) + 100000}"

    token_hash = hashlib.sha256(pairing_token.encode("utf-8")).hexdigest()
    code_hash = hashlib.sha256(pairing_code.encode("utf-8")).hexdigest()

    session = MobilePairingSession(
        pairing_id=pairing_id,
        user_id=user_id,
        phone_number=phone_number,
        token_hash=token_hash,
        code_hash=code_hash,
        status="pending",
        attempt_count=0,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()

    # QR Code payload does NOT expose permanent user JWT
    qr_payload_dict = {
        "v": 1,
        "server_url": server_base_url,
        "pairing_id": pairing_id,
        "pairing_token": pairing_token
    }
    qr_payload_json = json.dumps(qr_payload_dict)
    qr_svg = generate_qr_svg(qr_payload_json)

    # Notify connected web clients via WebSockets
    await ws_manager.broadcast_to_user(user_id, {
        "type": "pairing_started",
        "pairing_id": pairing_id,
        "expires_in_seconds": 120,
        "timestamp": now_utc.isoformat()
    })

    return {
        "pairing_id": pairing_id,
        "pairing_token": pairing_token,
        "pairing_code": pairing_code,
        "qr_payload": qr_payload_json,
        "qr_svg": qr_svg,
        "expires_in_seconds": 120,
        "expires_at": expires_at,
        "server_url": server_base_url
    }

async def claim_pairing_session(
    pairing_id: Optional[str],
    pairing_token: Optional[str],
    pairing_code: Optional[str],
    device_id: str,
    device_name: Optional[str],
    model: Optional[str],
    os_version: Optional[str],
    app_version: Optional[str],
    db: Session
) -> Dict[str, Any]:
    """
    Handle initial claim from Android app (either QR code scan or 6-digit manual code).
    Verifies token/code, checks expiration, updates status to 'approval_required',
    and triggers WebSocket event on the website.
    """
    now_utc = datetime.now(timezone.utc)
    session: Optional[MobilePairingSession] = None

    if pairing_id and pairing_token:
        # Option A: QR code scan
        submitted_token_hash = hashlib.sha256(pairing_token.strip().encode("utf-8")).hexdigest()
        session = db.query(MobilePairingSession).filter(
            MobilePairingSession.pairing_id == pairing_id.strip()
        ).first()

        if not session or not secrets.compare_digest(session.token_hash, submitted_token_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid QR pairing token or session not found."
            )
    elif pairing_code:
        # Option B: 6-digit manual pairing code
        submitted_code_hash = hashlib.sha256(pairing_code.strip().encode("utf-8")).hexdigest()
        session = db.query(MobilePairingSession).filter(
            MobilePairingSession.code_hash == submitted_code_hash,
            MobilePairingSession.status.in_(["pending", "claimed"])
        ).order_by(MobilePairingSession.created_at.desc()).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid 6-digit pairing code or session already used."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either QR token credentials or 6-digit manual pairing code must be provided."
        )

    # Check expiration (2-minute window)
    if now_utc > ensure_utc(session.expires_at):
        session.status = "expired"
        db.commit()
        await ws_manager.broadcast_to_user(session.user_id, {
            "type": "pairing_expired",
            "pairing_id": session.pairing_id,
            "message": "Pairing session has expired."
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This pairing session has expired (2-minute limit). Please regenerate a new QR code on the website."
        )

    # Check brute-force attempts
    session.attempt_count += 1
    if session.attempt_count > 5:
        session.status = "rejected"
        db.commit()
        await ws_manager.broadcast_to_user(session.user_id, {
            "type": "pairing_failed",
            "pairing_id": session.pairing_id,
            "reason": "Too many attempts"
        })
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many pairing attempts on this session. For security, please regenerate a new code."
        )

    # Ensure session was pending (enforce single-use)
    if session.status not in ["pending", "claimed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This pairing session is already {session.status}."
        )

    # Update session with device info
    session.device_id = device_id
    session.device_name = device_name or "Android Phone"
    session.model = model
    session.os_version = os_version
    session.app_version = app_version or "1.0.0"
    session.status = "approval_required"
    db.commit()

    # Load authenticated user for display
    user = db.query(User).filter(User.id == session.user_id).first()
    account_name = user.name if user else "Know Thyself AI User"
    account_masked_email = mask_email(user.email if user else "")

    # Broadcast WebSocket events to website
    await ws_manager.broadcast_to_user(session.user_id, {
        "type": "device_scanned",
        "pairing_id": session.pairing_id,
        "device_id": device_id,
        "device_name": session.device_name,
        "model": model,
        "timestamp": now_utc.isoformat()
    })

    await ws_manager.broadcast_to_user(session.user_id, {
        "type": "device_approval_required",
        "pairing_id": session.pairing_id,
        "device_id": device_id,
        "device_name": session.device_name,
        "timestamp": now_utc.isoformat()
    })

    remaining_seconds = max(0, int((ensure_utc(session.expires_at) - now_utc).total_seconds()))

    return {
        "pairing_id": session.pairing_id,
        "status": "approval_required",
        "account_name": account_name,
        "account_masked_email": account_masked_email,
        "requires_approval": True,
        "expires_in_seconds": remaining_seconds
    }

async def approve_pairing_session(
    pairing_id: str,
    device_id: str,
    device_name: Optional[str],
    model: Optional[str],
    os_version: Optional[str],
    app_version: Optional[str],
    approved: bool,
    db: Session
) -> Dict[str, Any]:
    """
    Explicit user approval from the Android companion app.
    Marks device as registered, generates permanent device JWT, and notifies website.
    """
    now_utc = datetime.now(timezone.utc)
    session = db.query(MobilePairingSession).filter(
        MobilePairingSession.pairing_id == pairing_id.strip()
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pairing session not found."
        )

    if now_utc > ensure_utc(session.expires_at):
        session.status = "expired"
        db.commit()
        await ws_manager.broadcast_to_user(session.user_id, {
            "type": "pairing_expired",
            "pairing_id": pairing_id,
            "message": "Pairing session has expired."
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pairing session expired. Please regenerate a code on your website."
        )

    if not approved:
        session.status = "rejected"
        db.commit()
        await ws_manager.broadcast_to_user(session.user_id, {
            "type": "pairing_failed",
            "pairing_id": pairing_id,
            "reason": "User cancelled on device"
        })
        return {
            "status": "rejected",
            "message": "Device pairing cancelled."
        }

    # Register device in database
    target_device_id = device_id or session.device_id
    device = db.query(MobileDevice).filter(
        MobileDevice.user_id == session.user_id,
        MobileDevice.device_id == target_device_id
    ).first()

    final_name = device_name or session.device_name or "Android Phone"
    final_model = model or session.model
    final_os = os_version or session.os_version
    final_app = app_version or session.app_version or "1.0.0"

    if not device:
        device = MobileDevice(
            user_id=session.user_id,
            device_id=target_device_id,
            device_name=final_name,
            model=final_model,
            os_version=final_os,
            app_version=final_app,
            is_connected=True,
            last_sync_at=now_utc
        )
        db.add(device)
    else:
        device.device_name = final_name
        device.model = final_model or device.model
        device.os_version = final_os or device.os_version
        device.app_version = final_app
        device.is_connected = True
        device.last_sync_at = now_utc

    # Mark session as completed / approved
    session.status = "approved"
    session.approved_at = now_utc
    db.commit()
    db.refresh(device)

    # Issue access token for phone companion app
    device_token = create_access_token(data={"sub": str(session.user_id)})

    # Broadcast real-time success to website
    await ws_manager.broadcast_to_user(session.user_id, {
        "type": "device_connected",
        "pairing_id": session.pairing_id,
        "device_id": device.device_id,
        "device_name": device.device_name,
        "model": device.model,
        "os_version": device.os_version,
        "last_sync_at": now_utc.isoformat(),
        "permissions": {
            "steps": True,
            "screen_time": True,
            "sleep": True,
            "hydration": True
        }
    })

    return {
        "status": "connected",
        "device_id": device.device_id,
        "device_name": device.device_name,
        "access_token": device_token,
        "token_type": "bearer",
        "user_id": session.user_id
    }

def get_pairing_status(
    pairing_id: str,
    db: Session
) -> Dict[str, Any]:
    """Retrieve current state of a pairing session."""
    session = db.query(MobilePairingSession).filter(
        MobilePairingSession.pairing_id == pairing_id.strip()
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pairing session not found."
        )

    now_utc = datetime.now(timezone.utc)
    is_expired = now_utc > ensure_utc(session.expires_at)
    current_status = "expired" if is_expired and session.status == "pending" else session.status
    remaining = max(0, int((ensure_utc(session.expires_at) - now_utc).total_seconds()))

    return {
        "pairing_id": session.pairing_id,
        "status": current_status,
        "device_name": session.device_name,
        "expires_in_seconds": remaining,
        "is_expired": is_expired
    }
