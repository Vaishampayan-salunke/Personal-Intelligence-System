from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone

from database import get_db
from app.models.user import User
from app.models.mobile_device import MobileDevice, MobileMetricLog
from app.models.record import DailyRecord
from app.schemas.mobile_metrics import (
    MobileConnectRequest, MobileDeviceResponse, MobileStatusResponse,
    MobileSyncPayload, MobileSyncResponse, PairingCodeResponse,
    WebSocketTicketResponse, PhoneVerificationRequest, PhoneVerificationResponse,
    OTPVerificationRequest, OTPVerificationResponse, PairingCreateRequest,
    PairingCreateResponse, PairingClaimRequest, PairingClaimResponse,
    PairingStatusResponse, PairingApproveRequest, PairingApproveResponse
)
from app.routes.dependencies import get_current_user, get_optional_current_user
from app.core.security import create_access_token
from app.services.mobile_sync import (
    create_pairing_code, verify_and_consume_pairing_code, process_mobile_sync
)
from app.services.pairing_service import (
    send_phone_verification_otp, verify_phone_otp, create_pairing_session,
    claim_pairing_session, approve_pairing_session, get_pairing_status
)
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/mobile", tags=["Mobile Integration"])

# -------------------------------------------------------------
# STEP 1: Phone Number & SMS Verification
# -------------------------------------------------------------

@router.post("/verify-phone", response_model=PhoneVerificationResponse)
def verify_phone_number(
    req: PhoneVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate real phone verification by sending an SMS OTP.
    Falls back to Development Sandbox Mode if SMS credentials are not configured.
    """
    return send_phone_verification_otp(current_user.id, req.country_code, req.phone_number, db)

@router.post("/verify-otp", response_model=OTPVerificationResponse)
def verify_otp_endpoint(
    req: OTPVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify the phone OTP submitted by the user.
    """
    return verify_phone_otp(current_user.id, req.country_code, req.phone_number, req.otp_code, db)

# -------------------------------------------------------------
# STEP 2: Secure QR Code & Manual Device Pairing
# -------------------------------------------------------------

@router.post("/pairing/create", response_model=PairingCreateResponse)
async def create_pairing(
    req: PairingCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a 2-minute cryptographically secure pairing session:
    - Unique pairing_id and single-use pairing token
    - 6-digit manual pairing code
    - Standalone SVG QR code containing server and session payload (no permanent JWT in QR)
    """
    server_base = str(request.base_url).rstrip("/")
    client_origin = request.headers.get("origin") or request.headers.get("referer")
    return await create_pairing_session(current_user.id, req.phone_number, server_base, db, client_origin=client_origin)

@router.post("/pairing/claim", response_model=PairingClaimResponse)
async def claim_pairing(
    claim_in: PairingClaimRequest,
    db: Session = Depends(get_db)
):
    """
    Android Companion App claims the pairing session via scanned QR token or 6-digit code.
    Transitions session to approval_required and alerts website via WebSocket.
    """
    return await claim_pairing_session(
        pairing_id=claim_in.pairing_id,
        pairing_token=claim_in.pairing_token,
        pairing_code=claim_in.pairing_code,
        device_id=claim_in.device_id,
        device_name=claim_in.device_name,
        model=claim_in.model,
        os_version=claim_in.os_version,
        app_version=claim_in.app_version,
        db=db
    )

@router.get("/pairing/status/{pairing_id}", response_model=PairingStatusResponse)
def check_pairing_status(
    pairing_id: str,
    db: Session = Depends(get_db)
):
    """
    Check the current status and remaining validity of a pairing session.
    """
    return get_pairing_status(pairing_id, db)

@router.post("/pairing/approve")
async def approve_pairing(
    approve_in: PairingApproveRequest,
    db: Session = Depends(get_db)
):
    """
    Explicit user approval from the Android Companion App.
    Registers the device, issues device access token, and notifies the website.
    """
    return await approve_pairing_session(
        pairing_id=approve_in.pairing_id,
        device_id=approve_in.device_id,
        device_name=approve_in.device_name,
        model=approve_in.model,
        os_version=approve_in.os_version,
        app_version=approve_in.app_version,
        approved=approve_in.approved,
        db=db
    )

@router.post("/pair-code", response_model=PairingCodeResponse)
def get_pairing_code(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a short-lived 6-digit numeric pairing code for pairing an Android phone.
    """
    code_data = create_pairing_code(current_user.id, expires_in_seconds=600)
    server_base = str(request.base_url).rstrip("/")
    return PairingCodeResponse(
        pairing_code=code_data["pairing_code"],
        expires_in_seconds=code_data["expires_in_seconds"],
        expires_at=code_data["expires_at"],
        server_url=server_base
    )

@router.post("/connect", response_model=MobileDeviceResponse)
def connect_device(
    connect_in: MobileConnectRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Register and pair an Android device with the authenticated account.
    Supports either direct JWT authentication or 6-digit pairing code verification.
    """
    user_id = current_user.id if current_user else None

    # If pairing code is provided, verify and resolve user
    if connect_in.pairing_code:
        resolved_user_id = verify_and_consume_pairing_code(connect_in.pairing_code)
        if not resolved_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired 6-digit pairing code. Please generate a new code from the dashboard."
            )
        user_id = resolved_user_id

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid JWT bearer token or pairing code."
        )

    device = db.query(MobileDevice).filter(
        MobileDevice.user_id == user_id,
        MobileDevice.device_id == connect_in.device_id
    ).first()

    now_utc = datetime.now(timezone.utc)

    if not device:
        device = MobileDevice(
            user_id=user_id,
            device_id=connect_in.device_id,
            device_name=connect_in.device_name or "Android Phone",
            model=connect_in.model,
            os_version=connect_in.os_version,
            app_version=connect_in.app_version or "1.0.0",
            is_connected=True,
            last_sync_at=now_utc
        )
        db.add(device)
    else:
        device.device_name = connect_in.device_name or device.device_name
        device.model = connect_in.model or device.model
        device.os_version = connect_in.os_version or device.os_version
        device.app_version = connect_in.app_version or device.app_version
        device.is_connected = True
        device.last_sync_at = now_utc

    db.commit()
    db.refresh(device)

    # Issue an access token for the companion app
    device_token = create_access_token(data={"sub": str(user_id)})
    response_data = MobileDeviceResponse.model_validate(device)
    response_data.access_token = device_token
    return response_data

@router.post("/sync", response_model=MobileSyncResponse)
async def sync_metrics(
    payload: MobileSyncPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Receive real-time and periodic telemetry from an Android device.
    Persists data in audit logs, updates daily cumulative records,
    recalculates score, and broadcasts live update via WebSockets.
    """
    return await process_mobile_sync(payload, current_user.id, db)

@router.get("/status", response_model=MobileStatusResponse)
def get_device_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return connection status, active devices, and last synchronization time.
    """
    devices = db.query(MobileDevice).filter(
        MobileDevice.user_id == current_user.id
    ).order_by(MobileDevice.updated_at.desc()).all()

    active_devices = [d for d in devices if d.is_connected]
    latest_sync = max((d.last_sync_at for d in devices if d.last_sync_at), default=None)

    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    summary = {
        "date": today_str,
        "steps": today_rec.steps if today_rec else 0,
        "screen_time": today_rec.screen_time if today_rec else 0.0,
        "sleep_hours": today_rec.sleep_hours if today_rec else 0.0,
        "exercise_minutes": today_rec.exercise_minutes if today_rec else 0,
        "water_intake": today_rec.water_intake if today_rec else 0.0
    }

    return MobileStatusResponse(
        is_connected=len(active_devices) > 0,
        devices=devices,
        active_device_count=len(active_devices),
        last_sync_at=latest_sync,
        today_synced_summary=summary
    )

@router.get("/latest")
def get_latest_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve the latest available metrics for the authenticated user.
    """
    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    latest_logs = db.query(MobileMetricLog).filter(
        MobileMetricLog.user_id == current_user.id
    ).order_by(MobileMetricLog.recorded_at.desc()).limit(10).all()

    return {
        "date": today_str,
        "daily_record": today_rec,
        "recent_telemetry": [
            {
                "type": log.metric_type,
                "value": log.metric_value,
                "unit": log.unit,
                "source": log.source,
                "recorded_at": log.recorded_at
            }
            for log in latest_logs
        ]
    }

@router.get("/history")
def get_metric_history(
    metric_type: Optional[str] = Query(None, description="Optional filter by metric type"),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve historical raw metric logs for this user with source and timestamp tracking.
    """
    q = db.query(MobileMetricLog).filter(MobileMetricLog.user_id == current_user.id)
    if metric_type:
        q = q.filter(MobileMetricLog.metric_type == metric_type)
    logs = q.order_by(MobileMetricLog.recorded_at.desc()).limit(limit).all()
    return logs

@router.delete("/disconnect")
async def disconnect_device(
    device_id: Optional[str] = Query(None, description="Specific device_id to disconnect"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect / unpair an Android device.
    Broadcasts device_disconnected WebSocket event to update the website instantly.
    """
    q = db.query(MobileDevice).filter(MobileDevice.user_id == current_user.id)
    if device_id:
        q = q.filter(MobileDevice.device_id == device_id)
    devices = q.all()

    if not devices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching device found to disconnect."
        )

    for d in devices:
        d.is_connected = False

    db.commit()

    # Broadcast disconnection to user's web session
    await ws_manager.broadcast_to_user(current_user.id, {
        "type": "device_disconnected",
        "device_id": device_id or "all",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {
        "status": "success",
        "message": f"Successfully disconnected {len(devices)} device(s)."
    }

@router.post("/ws-ticket", response_model=WebSocketTicketResponse)
def create_websocket_ticket(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a short-lived single-use ticket for authenticating WebSocket connections.
    Prevents placing permanent JWT tokens in URLs.
    """
    ticket = ws_manager.generate_ticket(current_user.id, expires_in_seconds=60)
    
    # Calculate ws:// or wss:// URL based on current request
    scheme = "wss" if request.url.scheme == "https" else "ws"
    host = request.headers.get("host") or request.url.netloc
    ws_url = f"{scheme}://{host}/ws/metrics?ticket={ticket}"

    return WebSocketTicketResponse(
        ticket=ticket,
        expires_in_seconds=60,
        ws_url=ws_url
    )
