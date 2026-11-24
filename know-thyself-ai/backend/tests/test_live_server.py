import threading
import time
import urllib.request
import json
import uvicorn
import os
import sys

# Add parent directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8005, log_level="warning")

def main():
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(2)

    base = "http://127.0.0.1:8005"

    # 1. Probe health
    with urllib.request.urlopen(f"{base}/health") as r:
        health_data = json.loads(r.read())
        print("1. Health check:", health_data)
        assert health_data["status"] == "healthy"

    # 2. Probe demo login
    req = urllib.request.Request(f"{base}/api/auth/demo-login", data=b"", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        demo_data = json.loads(r.read())
        token = demo_data["access_token"]
        print("2. Demo login successful! User:", demo_data["user"]["name"])
        assert token

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Probe dashboard
    req = urllib.request.Request(f"{base}/api/dashboard", headers=headers)
    with urllib.request.urlopen(req) as r:
        dash_data = json.loads(r.read())
        score = dash_data["intelligence_score"]["overall_score"]
        metrics = list(dash_data["metrics"].keys())
        print(f"3. Dashboard OK! Personal Intelligence Score: {score}/100, Metrics loaded: {metrics}")
        assert 0 <= score <= 100
        assert len(metrics) == 6

    # 4. Probe Ask AI Chat
    chat_payload = json.dumps({"question": "How many steps did I average this week?"}).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/api/ai/chat",
        data=chat_payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        chat_resp = json.loads(r.read())
        print("4. Ask Your Data AI answer:", chat_resp["answer"][:100], "...")
        assert "steps" in chat_resp["answer"].lower()

    # 5. Probe Privacy Export
    req = urllib.request.Request(f"{base}/api/privacy/export", headers=headers)
    with urllib.request.urlopen(req) as r:
        export_data = json.loads(r.read())
        count = len(export_data["daily_records"])
        print(f"5. Privacy export OK! Daily records exported: {count}")
        assert count > 0

    print("ALL LIVE SERVER INTEGRATION PROBES PASSED!")

if __name__ == "__main__":
    main()
