# Know Thyself AI — Personal Intelligence System

> **Tagline:** *Your Data. Your Intelligence.*  
> **Category:** AI-powered Personal Analytics and Behavioral Guidance Platform  
> **Built for:** 24-Hour Hackathon Production-Style Full-Stack Demonstration

---

## 1. Project Overview

People generate enormous volumes of lifestyle data through smartphones, smartwatches, fitness trackers, and wellness applications. However, this information remains fragmented across disparate apps, leaving users with raw numbers that offer little intuitive understanding of their habits.

**Know Thyself AI** unifies your daily activity, restorative sleep, screen time, workout routines, hydration, and mood. By leveraging a high-performance Python analytics engine combined with the official Google Gemini AI SDK, Know Thyself AI transforms raw entries into explainable behavioral patterns, transparent awareness scores, and contextual, achievable lifestyle suggestions.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Data Sources
        M[Manual Daily Logging]
        C[CSV File Batch Upload]
        S[30-Day Simulated Demo Data]
    end

    subgraph Backend - FastAPI Engine
        API[FastAPI REST Endpoints]
        AUTH[JWT & Bcrypt Security Layer]
        DB[(SQLAlchemy ORM - SQLite / PostgreSQL)]
        ANALYTICS[Python Analytics & Variance Engine]
        NUDGES[Deterministic Smart Nudge Engine]
        AI[Google Gemini 2.5 Flash / Analytics Fallback]
    end

    subgraph Frontend - React & Vite
        UI[Modern Colorful SaaS Dashboard]
        SCORE[Personal Intelligence Score Gauge]
        CHARTS[Interactive Recharts Visualizations]
        CHAT[Ask Your Data Conversational AI]
        PRIVACY[GDPR Export & Data Deletion Controls]
    end

    Data Sources --> API
    API --> AUTH
    AUTH --> DB
    DB --> ANALYTICS
    ANALYTICS --> NUDGES
    ANALYTICS --> AI
    AI --> CHAT
    ANALYTICS --> SCORE
    DB --> CHARTS
    API --> UI
```

---

## 3. Key Innovations & Differentiating Features

### 🌟 1. Personal Intelligence Score (0–100)
A completely transparent lifestyle awareness score computed mathematically from 5 categories:
- **Physical Activity (25 pts):** Normalized steps against user target.
- **Sleep Quality & Rhythm (25 pts):** Nightly duration plus circadian standard deviation penalty for erratic schedules.
- **Exercise & Vitality (20 pts):** Active workout frequency and minutes.
- **Digital Balance (15 pts):** Mindful moderation below user's screen-time threshold.
- **Routine & Hydration (15 pts):** Daily water intake and self-rated energy tracking.

*Clearly labeled as an application-generated lifestyle awareness indicator, not a clinically validated medical score.*

### 💬 2. Ask Your Data (Signature Conversational AI)
Ask natural language questions grounded exclusively in your authenticated lifestyle database records:
- *"How many steps did I average this week?"*
- *"How has my sleep changed over the last 7 days?"*
- *"Which days were least active?"*
- *"What should I improve next week?"*

**AI Safety Principles:**
- Strict per-user isolation: Gemini only receives aggregated metrics for the authenticated user.
- No hallucinations: If information is missing, the AI explains what data is absent.
- Offline Fallback: If `GEMINI_API_KEY` is not supplied or experiences network limits, a deterministic Python rule-engine answers seamlessly with zero errors.

### ⚡ 3. 1-Click Evaluation Demo Experience
Judges can click the **1-Click Demo** button on the Login page to instantly activate the pre-configured *Alex Morgan* account populated with 30 days of progressive, realistic synthetic data. All synthetic records carry a distinct `Simulated` tag for ethical transparency.

### 🔒 4. Privacy & Full Data Sovereignty
- **GDPR Article 20 Data Export:** Download a complete structured JSON archive of all your personal records, goals, and chat interactions with a single click.
- **AI Processing Consent:** Easily toggle off Gemini AI processing in Settings to force all analytics to execute strictly locally.
- **Wipe Personal Data:** Permanently cascade-delete all lifestyle records from the database in an ACID transaction while keeping the user account active.

---

## 4. Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Lucide React, Axios, React Router v6 |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2, PyJWT, Bcrypt, Uvicorn |
| **Database** | SQLite (default local) / PostgreSQL (managed cloud deployment) |
| **AI Engine** | Google Gemini API via official `google-genai` SDK + Python rule fallback |
| **Deployment** | Vercel (Frontend), Render / Railway / Docker (Backend) |

---

## 5. Quick Start (Run Locally)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend
```bash
cd know-thyself-ai/backend

# Create virtual environment (optional)
python -m venv venv
# On Windows: venv\Scripts\activate
# On Linux/macOS: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (optional: add your GEMINI_API_KEY)
cp .env.example .env

#environment
py -m venv .venv
.venv\Scripts\activate

# Run FastAPI server
uvicorn main:app --reload --port 8000
or
python -m uvicorn main:app --reload --port 8000
```
Backend runs at `http://127.0.0.1:8000`  
OpenAPI Documentation at `http://127.0.0.1:8000/docs`

### 2. Start the Frontend
```bash
cd know-thyself-ai/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend runs at `http://localhost:5173`

---

## 6. Testing & Quality Assurance

Run the automated backend test suite (8 integration tests covering authentication, user isolation, CRUD, sample data loader, AI fallback, and privacy deletion):
```bash
cd know-thyself-ai/backend
pytest tests -v
```

Test the live server integration probe:
```bash
python know-thyself-ai/backend/tests/test_live_server.py
```

Build the frontend production bundle:
```bash
cd know-thyself-ai/frontend
npm run build
```

---

## 8. Android Companion App & Real-Time Sensor Sync

Know Thyself AI features a native Kotlin Android companion app (`know-thyself-ai/android-app`) that synchronizes real-world health and usage data from your phone directly into the web dashboard in real time.

```mermaid
flowchart LR
    subgraph Android Phone
        SM[SensorManager Pedometer]
        USM[UsageStatsManager Screen Time]
        HC[Health Connect Sleep & Hydration]
        ROOM[(Room SQLite Offline Queue)]
        WM[WorkManager 15-min Sync]
    end

    subgraph Backend
        FASTAPI[FastAPI Mobile Endpoints]
        WS_POOL[WebSocket Connection Manager]
        DB[(PostgreSQL / SQLite)]
    end

    subgraph Web Dashboard
        REACT[React 18 Dashboard]
        HOOK[useLiveMetrics Hook]
    end

    SM --> WM
    USM --> WM
    HC --> WM
    WM -. Offline Cache .-> ROOM
    WM -->|HTTPS POST /api/mobile/sync| FASTAPI
    FASTAPI --> DB
    FASTAPI -->|metrics_update| WS_POOL
    WS_POOL -->|WebSocket /ws/metrics| HOOK
    HOOK --> REACT
```

### Key Mobile Capabilities:
1. **Secure QR Code & Manual Pairing with Phone Verification:**
   - **Step 1 (Phone OTP):** Verify mobile phone via real SMS OTP (Twilio) or Development Sandbox Mode (when SMS gateway credentials are not configured).
   - **Step 2 (Pairing):** Generate a 2-minute cryptographically secure pairing session via **Option A: Scan QR Code** or **Option B: 6-Digit Manual Code**.
   - **No Permanent JWT in QR Codes:** QR codes only contain ephemeral, single-use, hashed pairing session identifiers.
   - **Explicit On-Device Approval:** Android app scans the QR code or receives the 6-digit code, displays **"Do you want to connect this device to Know Thyself AI?"** with the user's masked account details, and requires an explicit tap on **"Approve & Connect"** before any device is registered.
   - **Real-Time WebSocket Events:** The website listens for `device_scanned`, `device_approval_required`, `device_connected`, and `device_disconnected` to transition UI states in real time.
2. **Hardware Pedometer (`SensorManager`):**
   - Reads `Sensor.TYPE_STEP_COUNTER` to count genuine physical steps taken today using midnight baseline calculation.
3. **App Usage Tracking (`UsageStatsManager`):**
   - Aggregates daily interactive foreground screen time with user approval via `Settings.ACTION_USAGE_ACCESS_SETTINGS`.
4. **Health Connect (`HealthConnectClient`):**
   - Automatically synchronizes sleep sessions (`SleepSessionRecord`), workouts (`ExerciseSessionRecord`), and water consumption (`HydrationRecord`).
5. **Offline Queue & Resiliency (`Room` + `WorkManager`):**
   - If network connectivity is lost, metric telemetry is queued locally in Room SQLite (`PendingSyncEntity`) and replayed upon reconnection.
6. **Live Instant Updates via WebSockets (`/ws/metrics`):**
   - Phone uploads immediately trigger live WebSocket broadcasts to the React web dashboard, updating scores, cards, and charts in real time without refreshing the page.

### Setting Up the Android App in Android Studio:
1. Open Android Studio and select **Open Project**.
2. Select the `know-thyself-ai/android-app` folder.
3. Allow Gradle to sync (includes CameraX and Google ML Kit Barcode Scanning).
4. Run the app on your physical Android phone (or Android emulator with API 34).
5. From the web dashboard (**Settings → Device Integration**), click **Connect Android Phone**.
6. Verify your phone number, then either scan the displayed QR code with your phone camera or enter the 6-digit code!
7. Tap **Approve & Connect** on your phone!

---

## 9. Environment Variables Reference

### Backend (`know-thyself-ai/backend/.env` or Render Dashboard)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Recommended | PostgreSQL connection URL (e.g., Supabase / Neon / Render Postgres). Default: SQLite. |
| `JWT_SECRET` | Required | Secure random secret string used to sign JWT tokens. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key. If omitted, local deterministic rule engine answers AI queries seamlessly. |
| `FRONTEND_ORIGIN` | Required in Prod | URL of your deployed frontend (e.g., `https://personal-intelligence-system-gamma.vercel.app`). |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio Account SID for sending real SMS OTPs. |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio Auth Token for SMS verification. |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio phone number sending the SMS. (If not set, system runs in Development Sandbox Mode). |

### Frontend (`know-thyself-ai/frontend/.env` or Vercel Dashboard)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Required in Prod | Backend API URL (e.g., `https://your-backend.onrender.com/api`). |


### Deploying Frontend to Vercel
1. Push your repository to GitHub.
2. In Vercel, import the project and set the **Root Directory** to `know-thyself-ai/frontend`.
3. Framework Preset: `Vite`.
4. Configure Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-service.onrender.com/api`
5. Deploy.

### Deploying Backend to Render
1. In Render, select **New Web Service** and link your GitHub repository.
2. Root Directory: `know-thyself-ai/backend`.
3. Runtime: `Python 3`.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
6. Environment Variables:
   - `DATABASE_URL`: Your managed PostgreSQL connection URL (or leave blank for SQLite).
   - `JWT_SECRET`: A secure random string.
   - `GEMINI_API_KEY`: Your key from [Google AI Studio](https://aistudio.google.com/apikey).
   - `ENVIRONMENT`: `production`.
   - `FRONTEND_ORIGIN`: `https://your-vercel-domain.vercel.app`.
7. Verify Health Endpoint at `https://your-backend-service.onrender.com/health`.
