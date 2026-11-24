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

# Run FastAPI server
uvicorn main:app --reload --port 8000
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

## 7. Online Deployment Guide

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
