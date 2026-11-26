from fastapi.testclient import TestClient
from main import app
import uuid

client = TestClient(app)

def test_forgot_password_flow_and_fresh_zero_state():
    test_email = f"reset_test_{uuid.uuid4().hex[:6]}@test.com"
    old_pwd = "OldPassword123!"
    new_pwd = "NewSecurePassword456!"

    # 1. Register fresh account
    reg = client.post("/api/auth/register", json={
        "name": "Reset Test User",
        "email": test_email,
        "password": old_pwd,
        "confirm_password": old_pwd
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify account is completely fresh at 0 (NO synthetic records)
    recs = client.get("/api/records", headers=headers).json()
    assert len(recs) == 0, f"Expected 0 records for fresh account, got {len(recs)}"

    dash = client.get("/api/dashboard", headers=headers).json()
    assert dash["metrics"]["steps"]["current_value"] == 0
    assert dash["metrics"]["sleep"]["current_value"] == 0
    assert dash["data_days_count"] == 0
    assert any(a["type"] == "fresh_start" for a in dash.get("live_alerts", []))
    print(" Verified fresh account has 0 records and fresh_start live alert.")

    # 3. Request Password Reset Code
    fp_res = client.post("/api/auth/forgot-password", json={"email": test_email})
    assert fp_res.status_code == 200
    fp_data = fp_res.json()
    reset_code = fp_data["reset_code"]
    assert len(reset_code) == 6
    print(f" Verified forgot-password code generated: {reset_code}")

    # 4. Reset Password using the code
    rp_res = client.post("/api/auth/reset-password", json={
        "email": test_email,
        "token": reset_code,
        "new_password": new_pwd,
        "confirm_password": new_pwd
    })
    assert rp_res.status_code == 200
    print(" Verified reset-password successfully changed password.")

    # 5. Old password should fail
    old_login = client.post("/api/auth/login", json={"email": test_email, "password": old_pwd})
    assert old_login.status_code == 401

    # 6. New password should succeed
    new_login = client.post("/api/auth/login", json={"email": test_email, "password": new_pwd})
    assert new_login.status_code == 200
    new_token = new_login.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}
    print(" Verified login with new password succeeds.")

    # 7. Sync Real-Time Phone Sensor Data (Steps + Screen Time)
    phone_sync = client.post("/api/records/sync-phone?steps=620&screen_time=0.4", headers=new_headers)
    assert phone_sync.status_code == 200
    synced_rec = phone_sync.json()
    assert synced_rec["steps"] == 620
    assert synced_rec["screen_time"] == 0.4
    print(" Verified real-time Android phone sync sets steps=620 and screen_time=0.4h.")

    # 8. Reset to Fresh 0
    reset_zero = client.post("/api/auth/reset-fresh", headers=new_headers)
    assert reset_zero.status_code == 200
    recs_after = client.get("/api/records", headers=new_headers).json()
    assert len(recs_after) == 0
    print(" Verified reset-fresh wipes back to 0 records.")

    print("\n>>> ALL FORGOT PASSWORD & REAL-TIME PHONE SYNC TESTS PASSED! <<<")

if __name__ == "__main__":
    test_forgot_password_flow_and_fresh_zero_state()
