import os
import json
import time
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.security import decode_access_token
from database import init_db, SessionLocal
from app.models.user import User

# Import routers
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.records import router as records_router
from app.routes.insights import router as insights_router
from app.routes.ai import router as ai_router
from app.routes.nudges import router as nudges_router
from app.routes.goals import router as goals_router
from app.routes.privacy import router as privacy_router
from app.routes.mobile import router as mobile_router
from app.services.websocket_manager import ws_manager

app = FastAPI(
    title="Know Thyself AI — Personal Intelligence System",
    description="Full-stack AI-powered personal analytics platform that unifies lifestyle data, reveals behavioural patterns, and recommends actionable wellness improvements.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev & production cross-origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to ensure database tables are created
@app.on_event("startup")
def on_startup():
    try:
        init_db()
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Database initialization at startup encountered an issue: {e}")

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "Know Thyself AI Backend",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }

@app.get("/", tags=["System"])
def root():
    return {
        "message": "Welcome to Know Thyself AI — Your Data. Your Intelligence.",
        "docs": "/docs",
        "health": "/health"
    }

# Register API routers
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(records_router)
app.include_router(insights_router)
app.include_router(ai_router)
app.include_router(nudges_router)
app.include_router(goals_router)
app.include_router(privacy_router)
app.include_router(mobile_router)

@app.websocket("/ws/metrics")
async def websocket_metrics_endpoint(
    websocket: WebSocket,
    ticket: str = Query(None),
    token: str = Query(None)
):
    """
    Real-Time WebSocket route for Know Thyself AI metrics streaming.
    Authenticates via short-lived single-use ticket or fallback JWT token.
    Maintains per-user isolated connection pools and broadcasts live Android telemetry.
    """
    user_id = None

    # 1. Try single-use ticket first (preferred secure method)
    if ticket:
        user_id = ws_manager.validate_and_consume_ticket(ticket)

    # 2. Fallback to token if ticket not provided
    if not user_id and token:
        try:
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.email == payload["sub"]).first()
                    if user:
                        user_id = user.id
                finally:
                    db.close()
        except Exception:
            user_id = None

    if not user_id:
        if ticket or token:
            # Query param credentials supplied but invalid/expired - reject handshake immediately
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Accept and check if client sends {"type": "authenticate", "ticket": ...} or {"type": "authenticate", "token": ...}
        await websocket.accept()
        try:
            init_msg = await websocket.receive_text()
            data = json.loads(init_msg)
            if data.get("type") == "authenticate":
                auth_ticket = data.get("ticket")
                auth_token = data.get("token")
                if auth_ticket:
                    user_id = ws_manager.validate_and_consume_ticket(auth_ticket)
                elif auth_token:
                    payload = decode_access_token(auth_token)
                    if payload and "sub" in payload:
                        db = SessionLocal()
                        try:
                            user = db.query(User).filter(User.email == payload["sub"]).first()
                            if user:
                                user_id = user.id
                        finally:
                            db.close()
        except Exception:
            user_id = None

        if not user_id:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Authentication failed. Invalid or expired ticket/token."
            }))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Add to manager
        if user_id not in ws_manager.active_connections:
            ws_manager.active_connections[user_id] = set()
        ws_manager.active_connections[user_id].add(websocket)
    else:
        await ws_manager.connect(websocket, user_id)

    # Acknowledge connection
    await websocket.send_text(json.dumps({
        "type": "connected",
        "message": "Connected to Know Thyself AI real-time lifestyle stream.",
        "user_id": user_id,
        "timestamp": time.time()
    }))

    try:
        while True:
            msg_text = await websocket.receive_text()
            try:
                msg_data = json.loads(msg_text)
                msg_type = msg_data.get("type")
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": time.time()
                    }))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception:
        ws_manager.disconnect(websocket, user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
