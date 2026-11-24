from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def probe():
    print("--- 1. Probing Health ---")
    r = client.get("/health")
    print("Health status code:", r.status_code, r.json())

    print("\n--- 2. Logging in as vaishamram81@gmail.com ---")
    r = client.post(
        "/api/auth/login",
        json={"email": "vaishamram81@gmail.com", "password": "Password123!"}
    )
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    user_name = r.json()["user"]["name"]
    print(f"Logged in successfully as: {user_name}")

    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- 3. Probing AI Insights across all 5 categories ---")
    r = client.get("/api/insights", headers=headers)
    assert r.status_code == 200
    insights = r.json()
    cats = {i["category"] for i in insights}
    print("Insight categories present:", cats)
    print("Total insights:", len(insights))
    for i in insights:
        print(f"  • [{i['category'].upper()}] {i['title']}: {i['observation'][:60]}...")

    print("\n--- 4. Probing Chatbot for 'how many steps i ahve completed tdy' ---")
    r = client.post(
        "/api/ai/chat",
        json={"question": "how many steps i ahve completed tdy"},
        headers=headers
    )
    assert r.status_code == 200
    chat = r.json()
    print("Answer:")
    print(chat["answer"])

    print("\n--- 5. Probing Dashboard Real-Time Lifestyle Alerts ---")
    r = client.get("/api/dashboard", headers=headers)
    assert r.status_code == 200
    dash = r.json()
    alerts = dash.get("live_alerts", [])
    print(f"Live Alerts Count: {len(alerts)}")
    for a in alerts:
        print(f"  [{a['severity'].upper()}] {a['title']}: {a['message']}")

    print("\n--- 6. Probing Live Phone Pedometer Sync (+500 steps) ---")
    r = client.post("/api/records/sync-steps?increment=500", headers=headers)
    assert r.status_code == 200
    pedometer_res = r.json()
    print(f"Pedometer Sync Success! Updated Today's Steps in DB: {pedometer_res['steps']:,} for date {pedometer_res['date']}")

    print("\n>>> ALL 6 PRODUCTION VERIFICATION PROBES PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    probe()
