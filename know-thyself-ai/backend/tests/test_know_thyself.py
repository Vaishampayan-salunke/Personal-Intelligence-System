import pytest
import uuid
from fastapi.testclient import TestClient
from main import app
from database import Base, engine

client = TestClient(app)

TEST_RUN_ID = uuid.uuid4().hex[:6]
USER1_EMAIL = f"user1_{TEST_RUN_ID}@test.com"
ALICE_EMAIL = f"alice_{TEST_RUN_ID}@test.com"
BOB_EMAIL = f"bob_{TEST_RUN_ID}@test.com"

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "Know Thyself AI" in data["service"]

def test_register_and_login():
    email = USER1_EMAIL
    pwd = "SecurePassword123!"
    
    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "name": "Jordan Lee",
        "email": email,
        "password": pwd,
        "confirm_password": pwd
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == email

    # 2. Duplicate registration should fail
    dup_res = client.post("/api/auth/register", json={
        "name": "Jordan Lee Duplicate",
        "email": email,
        "password": pwd,
        "confirm_password": pwd
    })
    assert dup_res.status_code == 400

    # 3. Login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": pwd
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    assert token

    # 4. Get Current User Profile
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Jordan Lee"

def test_user_data_isolation():
    # Create User A
    token_a = client.post("/api/auth/register", json={
        "name": "Alice User", "email": ALICE_EMAIL, "password": "Password123!", "confirm_password": "Password123!"
    }).json()["access_token"]

    # Create User B
    token_b = client.post("/api/auth/register", json={
        "name": "Bob User", "email": BOB_EMAIL, "password": "Password123!", "confirm_password": "Password123!"
    }).json()["access_token"]

    # User A creates a record for an upcoming date
    rec_res = client.post("/api/records", json={
        "date": "2026-12-01",
        "steps": 9500,
        "sleep_hours": 7.5,
        "screen_time": 3.5,
        "exercise_minutes": 40,
        "water_intake": 2.8,
        "mood": "Great",
        "energy": 8
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert rec_res.status_code == 201
    rec_a_id = rec_res.json()["id"]

    # User B should NOT see User A's record in their records list
    b_records = client.get("/api/records", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert not any(r["id"] == rec_a_id for r in b_records)

    # User B should NOT be able to edit User A's record
    update_res = client.put(f"/api/records/{rec_a_id}", json={"steps": 12000}, headers={"Authorization": f"Bearer {token_b}"})
    assert update_res.status_code == 404

    # User B should NOT be able to delete User A's record
    del_res = client.delete(f"/api/records/{rec_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert del_res.status_code == 404

def test_daily_records_crud_and_duplicate_prevention():
    token = client.post("/api/auth/login", json={"email": ALICE_EMAIL, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add second record
    res2 = client.post("/api/records", json={
        "date": "2026-12-02",
        "steps": 7200,
        "sleep_hours": 6.8,
        "screen_time": 4.5,
        "exercise_minutes": 25,
        "water_intake": 2.2,
        "mood": "Good",
        "energy": 7
    }, headers=headers)
    assert res2.status_code == 201
    rec_id = res2.json()["id"]

    # Try duplicate date -> Should fail with 400
    dup_res = client.post("/api/records", json={
        "date": "2026-12-02",
        "steps": 8000
    }, headers=headers)
    assert dup_res.status_code == 400

    # Update record
    upd_res = client.put(f"/api/records/{rec_id}", json={"steps": 8500, "energy": 8}, headers=headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["steps"] == 8500
    assert upd_res.json()["energy"] == 8

    # Delete record
    del_res = client.delete(f"/api/records/{rec_id}", headers=headers)
    assert del_res.status_code == 200

def test_load_sample_data_and_dashboard():
    token = client.post("/api/auth/login", json={"email": BOB_EMAIL, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Load 30 days of sample data
    sample_res = client.post("/api/records/load-sample?days=30", headers=headers)
    assert sample_res.status_code == 200
    assert len(sample_res.json()) >= 25

    # Check Dashboard API
    dash_res = client.get("/api/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "metrics" in dash_data
    assert "steps" in dash_data["metrics"]
    assert "sleep" in dash_data["metrics"]
    assert "intelligence_score" in dash_data
    score = dash_data["intelligence_score"]["overall_score"]
    assert 0 <= score <= 100
    assert len(dash_data["intelligence_score"]["breakdown"]) == 5

    # Check Dashboard Trends API
    trend_res = client.get("/api/dashboard/trends?days=14", headers=headers)
    assert trend_res.status_code == 200
    assert len(trend_res.json()["trend_data"]) >= 14

def test_ai_insights_and_ask_your_data():
    token = client.post("/api/auth/login", json={"email": BOB_EMAIL, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Generate insights
    ins_res = client.post("/api/insights/generate", headers=headers)
    assert ins_res.status_code == 200
    insights = ins_res.json()["insights"]
    assert len(insights) > 0
    first_ins = insights[0]
    assert first_ins["title"]
    assert first_ins["observation"]
    assert first_ins["evidence"]
    assert first_ins["recommendation"]

    # 2. Ask Your Data Chatbot
    chat_res = client.post("/api/ai/chat", json={"question": "How many steps did I average this week?"}, headers=headers)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["answer"]
    assert "steps" in chat_data["answer"].lower()

    # 3. Ask another targeted question
    sleep_chat = client.post("/api/ai/chat", json={"question": "How has my sleep changed?"}, headers=headers)
    assert sleep_chat.status_code == 200
    assert "sleep" in sleep_chat.json()["answer"].lower()

def test_smart_nudges_and_goals():
    token = client.post("/api/auth/login", json={"email": BOB_EMAIL, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Nudges
    nudges_res = client.get("/api/nudges", headers=headers)
    assert nudges_res.status_code == 200
    nudges = nudges_res.json()
    assert len(nudges) > 0
    nudge_id = nudges[0]["id"]

    # Mark completed
    patch_res = client.patch(f"/api/nudges/{nudge_id}", json={"status": "completed"}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"

    # Goals
    goals_res = client.get("/api/goals", headers=headers)
    assert goals_res.status_code == 200
    assert len(goals_res.json()) >= 4 # default goals auto-created

    # Create custom goal
    new_goal = client.post("/api/goals", json={
        "metric": "water",
        "title": "Drink 3L Hydration Target",
        "target_value": 3.0,
        "timeframe": "daily"
    }, headers=headers)
    assert new_goal.status_code == 201

def test_privacy_export_and_deletion():
    token = client.post("/api/auth/login", json={"email": BOB_EMAIL, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Export Data
    exp_res = client.get("/api/privacy/export", headers=headers)
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert "daily_records" in exp_data
    assert "export_metadata" in exp_data
    assert len(exp_data["daily_records"]) > 0

    # 2. Delete all lifestyle data
    del_res = client.delete("/api/privacy/data", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify records are 0
    records_now = client.get("/api/records", headers=headers).json()
    assert len(records_now) == 0

    # User can still access account
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
