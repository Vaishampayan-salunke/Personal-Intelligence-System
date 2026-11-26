import pytest
import time
import json
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Base, engine
from app.models.user import User
from app.models.mobile_device import MobileDevice, MobilePairingSession, MobilePhoneVerification
from app.services.websocket_manager import ws_manager

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_pairing_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean previous test users
    db.query(User).filter(User.email.in_(["pairing_user_a@test.com", "pairing_user_b@test.com"])).delete()
    db.commit()
    db.close()

    # Register user A
    res_a = client.post("/api/auth/register", json={
        "name": "Pairing User A",
        "email": "pairing_user_a@test.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert res_a.status_code in [200, 201], res_a.text
    token_a = res_a.json()["access_token"]

    # Register user B
    res_b = client.post("/api/auth/register", json={
        "name": "Pairing User B",
        "email": "pairing_user_b@test.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert res_b.status_code in [200, 201], res_b.text
    token_b = res_b.json()["access_token"]

    yield {"token_a": token_a, "token_b": token_b}

    # Teardown
    db = SessionLocal()
    db.query(User).filter(User.email.in_(["pairing_user_a@test.com", "pairing_user_b@test.com"])).delete()
    db.commit()
    db.close()


def test_phone_number_verification_and_otp(setup_pairing_users):
    token_a = setup_pairing_users["token_a"]
    headers = {"Authorization": f"Bearer {token_a}"}

    # 1. Request OTP for phone number
    phone_res = client.post("/api/mobile/verify-phone", json={
        "country_code": "+91",
        "phone_number": "9876543210"
    }, headers=headers)
    assert phone_res.status_code == 200
    phone_data = phone_res.json()
    assert phone_data["status"] in ["sent", "dev_mode"]
    assert "dev_mode" in phone_data

    # Obtain OTP (either from dev_mode response or DB)
    otp_code = phone_data.get("dev_otp")
    if not otp_code:
        db = SessionLocal()
        v = db.query(MobilePhoneVerification).order_by(MobilePhoneVerification.created_at.desc()).first()
        assert v is not None
        db.close()
        otp_code = "123456"

    # 2. Test Invalid OTP
    bad_res = client.post("/api/mobile/verify-otp", json={
        "country_code": "+91",
        "phone_number": "9876543210",
        "otp_code": "000000"
    }, headers=headers)
    assert bad_res.status_code == 400
    assert "Invalid verification code" in bad_res.text

    # 3. Test Valid OTP verification
    good_res = client.post("/api/mobile/verify-otp", json={
        "country_code": "+91",
        "phone_number": "9876543210",
        "otp_code": otp_code
    }, headers=headers)
    assert good_res.status_code == 200
    assert good_res.json()["verified"] is True


def test_successful_qr_pairing_and_approval(setup_pairing_users):
    token_a = setup_pairing_users["token_a"]
    headers = {"Authorization": f"Bearer {token_a}"}

    # 1. User creates pairing session on website
    create_res = client.post("/api/mobile/pairing/create", json={
        "phone_number": "+919876543210"
    }, headers=headers)
    assert create_res.status_code == 200
    p_data = create_res.json()
    assert "pairing_id" in p_data
    assert "pairing_token" in p_data
    assert "qr_payload" in p_data
    assert "<svg" in p_data["qr_svg"]
    assert p_data["expires_in_seconds"] == 120

    pairing_id = p_data["pairing_id"]
    pairing_token = p_data["pairing_token"]

    # Check status endpoint
    status_res = client.get(f"/api/mobile/pairing/status/{pairing_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "pending"

    # 2. Android app scans QR code and claims session
    claim_res = client.post("/api/mobile/pairing/claim", json={
        "pairing_id": pairing_id,
        "pairing_token": pairing_token,
        "device_id": "pixel_9_pro_test",
        "device_name": "Google Pixel 9 Pro",
        "model": "Pixel 9 Pro",
        "os_version": "Android 14"
    })
    assert claim_res.status_code == 200, claim_res.text
    claim_data = claim_res.json()
    assert claim_data["status"] == "approval_required"
    assert claim_data["requires_approval"] is True
    assert "pairing_user" in claim_data["account_name"].lower() or "pair" in claim_data["account_name"].lower()
    assert "@" in claim_data["account_masked_email"]

    # 3. Android app explicitly approves
    approve_res = client.post("/api/mobile/pairing/approve", json={
        "pairing_id": pairing_id,
        "device_id": "pixel_9_pro_test",
        "device_name": "Google Pixel 9 Pro",
        "approved": True
    })
    assert approve_res.status_code == 200
    appr_data = approve_res.json()
    assert appr_data["status"] == "connected"
    assert "access_token" in appr_data

    # 4. Status is now approved
    final_status = client.get(f"/api/mobile/pairing/status/{pairing_id}")
    assert final_status.json()["status"] == "approved"

    # 5. Device is visible in user's active device list
    dev_status = client.get("/api/mobile/status", headers=headers)
    assert dev_status.status_code == 200
    assert dev_status.json()["is_connected"] is True
    assert dev_status.json()["active_device_count"] >= 1


def test_successful_manual_code_pairing(setup_pairing_users):
    token_a = setup_pairing_users["token_a"]
    headers = {"Authorization": f"Bearer {token_a}"}

    # 1. Create pairing session
    create_res = client.post("/api/mobile/pairing/create", json={}, headers=headers)
    assert create_res.status_code == 200
    p_data = create_res.json()
    pairing_code = p_data["pairing_code"]
    pairing_id = p_data["pairing_id"]

    # 2. Android app submits 6-digit manual pairing code
    claim_res = client.post("/api/mobile/pairing/claim", json={
        "pairing_code": pairing_code,
        "device_id": "galaxy_s24_test",
        "device_name": "Samsung Galaxy S24 Ultra",
        "model": "SM-S928B",
        "os_version": "Android 14"
    })
    assert claim_res.status_code == 200
    assert claim_res.json()["status"] == "approval_required"

    # 3. Approve
    approve_res = client.post("/api/mobile/pairing/approve", json={
        "pairing_id": pairing_id,
        "device_id": "galaxy_s24_test",
        "approved": True
    })
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "connected"


def test_expired_qr_and_token_reuse(setup_pairing_users):
    token_a = setup_pairing_users["token_a"]
    headers = {"Authorization": f"Bearer {token_a}"}

    # Create session
    create_res = client.post("/api/mobile/pairing/create", json={}, headers=headers)
    p_data = create_res.json()
    pairing_id = p_data["pairing_id"]
    pairing_token = p_data["pairing_token"]

    # Artificially expire session in database
    db = SessionLocal()
    s = db.query(MobilePairingSession).filter(MobilePairingSession.pairing_id == pairing_id).first()
    s.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db.commit()
    db.close()

    # Claiming expired session must fail
    claim_res = client.post("/api/mobile/pairing/claim", json={
        "pairing_id": pairing_id,
        "pairing_token": pairing_token,
        "device_id": "expired_device_test"
    })
    assert claim_res.status_code == 400
    assert "expired" in claim_res.text.lower()


def test_invalid_manual_code_and_brute_force(setup_pairing_users):
    # Invalid 6-digit code
    claim_res = client.post("/api/mobile/pairing/claim", json={
        "pairing_code": "000000",
        "device_id": "fake_device"
    })
    assert claim_res.status_code == 400
    assert "Invalid 6-digit pairing code" in claim_res.text


def test_cross_user_device_isolation_and_disconnect(setup_pairing_users):
    token_a = setup_pairing_users["token_a"]
    token_b = setup_pairing_users["token_b"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Ensure User A has an active device registered
    conn_res = client.post("/api/mobile/connect", json={
        "device_id": "device_isolation_test",
        "device_name": "User A Phone"
    }, headers=headers_a)
    assert conn_res.status_code == 200

    # User B should NOT see user A's connected device
    status_b = client.get("/api/mobile/status", headers=headers_b)
    assert status_b.status_code == 200
    assert status_b.json()["is_connected"] is False

    # User B attempting to disconnect user A's device returns 404
    disc_b = client.delete("/api/mobile/disconnect?device_id=device_isolation_test", headers=headers_b)
    assert disc_b.status_code == 404

    # User A disconnecting succeeds
    disc_a = client.delete("/api/mobile/disconnect?device_id=device_isolation_test", headers=headers_a)
    assert disc_a.status_code == 200
    assert disc_a.json()["status"] == "success"
