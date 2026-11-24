import os
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from database import init_db

# Import routers
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.records import router as records_router
from app.routes.insights import router as insights_router
from app.routes.ai import router as ai_router
from app.routes.nudges import router as nudges_router
from app.routes.goals import router as goals_router
from app.routes.privacy import router as privacy_router

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
    init_db()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
