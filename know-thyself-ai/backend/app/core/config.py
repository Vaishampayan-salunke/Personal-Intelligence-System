import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Know Thyself AI"
    TAGLINE: str = "Your Data. Your Intelligence."
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./know_thyself.db")
    
    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "know-thyself-super-secure-jwt-secret-key-2026-hackathon")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # CORS
    FRONTEND_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "*"
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
