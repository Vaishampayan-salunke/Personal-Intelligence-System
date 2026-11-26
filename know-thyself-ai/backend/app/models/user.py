from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    daily_records = relationship("DailyRecord", back_populates="user", cascade="all, delete-orphan", order_by="desc(DailyRecord.date)")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    insights = relationship("Insight", back_populates="user", cascade="all, delete-orphan")
    nudges = relationship("Nudge", back_populates="user", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    mobile_devices = relationship("MobileDevice", back_populates="user", cascade="all, delete-orphan")
    mobile_logs = relationship("MobileMetricLog", back_populates="user", cascade="all, delete-orphan")

class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    primary_goal = Column(String(150), default="Improve overall wellness and routine")
    step_target = Column(Integer, default=8000)
    sleep_target = Column(Float, default=8.0)
    exercise_target = Column(Integer, default=30)
    water_target = Column(Float, default=2.5)
    screen_time_limit = Column(Float, default=4.0)
    preferred_sleep_time = Column(String(10), default="23:00")
    ai_consent = Column(Boolean, default=True)
    notification_preferences = Column(Text, default='{"daily_summary": true, "smart_nudges": true, "goal_alerts": true}')
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="preferences")
