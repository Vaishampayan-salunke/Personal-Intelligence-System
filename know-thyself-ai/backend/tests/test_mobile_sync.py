import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
from main import app
from database import SessionLocal, Base, engine
from app.models.user import User
from app.models.mobile_device import MobileDevice, MobileMetricLog
from app.models.record import DailyRecord

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_mobile_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean previous test users
    db.query(User).filter(User.email.in_(["mobile_user_a@test.com", "mobile_user_b@test.com"])).delete()
    db.commit()
    db.close()

    # Register user A
    res_a = client.post("/api/auth/register", json={
        "name": "Mobile Tester A",
        "email": "mobile_user_a@test.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert res_a.status_code in [200, 201], res_a.text
    token_a = res_a.json()["access_token"]

    # Register user B
    res_b = client.post("/api/auth/register", json={
        "name": "Mobile Tester B",
        "email": "mobile_user_b@test.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert res_b.status_code in [200, 201], res_b.text
    token_b = res_b.json()["access_token"]

    yield {"token_a": token_a, "token_b": token_b}

    # Cleanup
    db = SessionLocal()
    db.query(User).filter(User.email.in_(["mobile_user_a@test.com", "mobile_user_b@test.com"])).delete()
    db.commit()
    db.close()


def test_pairing_code_and_connect(setup_mobile_users):
    token_a = setup_mobile_users["token_a"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Request pairing code
    pair_res = client.post("/api/mobile/pair-code", headers=headers_a)
    assert pair_res.status_code == 200
    pair_data = pair_res.json()
    assert "pairing_code" in pair_data
    assert len(pair_data["pairing_code"]) == 6
    code = pair_data["pairing_code"]

    # 2. Connect device using pairing code (simulating Android app)
    connect_res = client.post("/api/mobile/connect", json={
        "device_id": "pixel_8_pro_001",
        "device_name": "Google Pixel 8 Pro",
        "model": "Pixel 8 Pro",
        "os_version": "Android 14 (API 34)",
        "app_version": "1.0.0",
        "pairing_code": code
    })
    assert connect_res.status_code == 200, connect_res.text
    dev_data = connect_res.json()
    assert dev_data["device_id"] == "pixel_8_pro_001"
    assert dev_data["is_connected"] is True

    # 3. Attempting to use same code again must fail (single-use!)
    second_connect = client.post("/api/mobile/connect", json={
        "device_id": "another_device",
        "pairing_code": code
    })
    assert second_connect.status_code == 400


def test_mobile_sync_cumulative_telemetry(setup_mobile_users):
    token_a = setup_mobile_users["token_a"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Upload initial batch of phone metrics
    sync_payload = {
        "device_id": "pixel_8_pro_001",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "source": "android",
        "sync_id": "batch_001",
        "metrics": {
            "steps": 4250,
            "screen_time_minutes": 150.0, # 2.5 hours
            "sleep_minutes": 420.0,       # 7.0 hours
            "exercise_minutes": 35,
            "water_ml": 1750.0            # 1.75 L
        },
        "available": {
            "steps": True,
            "screen_time": True,
            "sleep": True,
            "exercise": True,
            "hydration": True
        }
    }

    res = client.post("/api/mobile/sync", json=sync_payload, headers=headers_a)
    assert res.status_code == 200, res.text
    sync_res = res.json()
    assert sync_res["status"] == "success"
    metrics = sync_res["current_metrics"]
    assert metrics["steps"] == 4250
    assert metrics["screen_time"] == 2.5
    assert metrics["sleep_hours"] == 7.0
    assert metrics["exercise_minutes"] == 35
    assert metrics["water_intake"] == 1.75

    # 2. Test idempotency (same sync_id should not duplicate or error)
    idempotent_res = client.post("/api/mobile/sync", json=sync_payload, headers=headers_a)
    assert idempotent_res.status_code == 200
    assert "already_processed" in str(idempotent_res.json())

    # 3. Upload second batch with cumulative steps (5800) and increased screen time (210 min = 3.5 hrs)
    sync_payload_2 = {
        "device_id": "pixel_8_pro_001",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "source": "android",
        "sync_id": "batch_002",
        "metrics": {
            "steps": 5800,
            "screen_time_minutes": 210.0,
            "sleep_minutes": 0,
            "exercise_minutes": 45,
            "water_ml": 2250.0
        }
    }
    res2 = client.post("/api/mobile/sync", json=sync_payload_2, headers=headers_a)
    assert res2.status_code == 200
    metrics2 = res2.json()["current_metrics"]
    assert metrics2["steps"] == 5800
    assert metrics2["screen_time"] == 3.5
    assert metrics2["exercise_minutes"] == 45
    assert metrics2["water_intake"] == 2.25
    # Previous sleep must NOT be wiped by 0:
    assert metrics2["sleep_hours"] == 7.0


def test_device_status_and_history(setup_mobile_users):
    token_a = setup_mobile_users["token_a"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Status endpoint
    status_res = client.get("/api/mobile/status", headers=headers_a)
    assert status_res.status_code == 200
    s_data = status_res.json()
    assert s_data["is_connected"] is True
    assert s_data["active_device_count"] >= 1
    assert s_data["today_synced_summary"]["steps"] >= 5800

    # Latest endpoint
    latest_res = client.get("/api/mobile/latest", headers=headers_a)
    assert latest_res.status_code == 200
    l_data = latest_res.json()
    assert "daily_record" in l_data
    assert len(l_data["recent_telemetry"]) > 0

    # History endpoint
    hist_res = client.get("/api/mobile/history?limit=10", headers=headers_a)
    assert hist_res.status_code == 200
    logs = hist_res.json()
    assert len(logs) > 0
    metric_types = [entry["metric_type"] for entry in logs]
    assert "steps" in metric_types


def test_websocket_ticket_generation_and_validation(setup_mobile_users):
    token_a = setup_mobile_users["token_a"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Generate ticket
    t_res = client.post("/api/mobile/ws-ticket", headers=headers_a)
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert "ticket" in t_data
    assert t_data["ticket"].startswith("wst_")
    assert "ws_url" in t_data

    # Test WebSocket connection via TestClient websocket
    with client.websocket_connect(f"/ws/metrics?ticket={t_data['ticket']}") as websocket:
        msg = websocket.receive_json()
        assert msg["type"] == "connected"
        # Test ping/pong
        websocket.send_json({"type": "ping"})
        pong = websocket.receive_json()
        assert pong["type"] == "pong"

    # Ticket should be consumed now and cannot be reused
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/metrics?ticket={t_data['ticket']}"):
            pass


def test_user_isolation_and_disconnect(setup_mobile_users):
    token_a = setup_mobile_users["token_a"]
    token_b = setup_mobile_users["token_b"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B status should show NO devices connected
    status_b = client.get("/api/mobile/status", headers=headers_b)
    assert status_b.status_code == 200
    assert status_b.json()["is_connected"] is False
    assert status_b.json()["active_device_count"] == 0

    # User B disconnect on user A's device should return 404
    disc_b = client.delete("/api/mobile/disconnect?device_id=pixel_8_pro_001", headers=headers_b)
    assert disc_b.status_code == 404

    # User A disconnect succeeds
    disc_a = client.delete("/api/mobile/disconnect?device_id=pixel_8_pro_001", headers=headers_a)
    assert disc_a.status_code == 200
    assert disc_a.json()["status"] == "success"

    # User A status now disconnected
    status_a_after = client.get("/api/mobile/status", headers=headers_a)
    assert status_a_after.json()["is_connected"] is False
