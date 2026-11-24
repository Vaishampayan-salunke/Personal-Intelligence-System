from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    metric = Column(String(50), nullable=False) # steps, sleep, exercise, water, screen_time
    title = Column(String(100), nullable=False)
    target_value = Column(Float, nullable=False)
    timeframe = Column(String(20), default="daily") # daily, weekly
    status = Column(String(20), default="active") # active, achieved, paused
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="goals")
