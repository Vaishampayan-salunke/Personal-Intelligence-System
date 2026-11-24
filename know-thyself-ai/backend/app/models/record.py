from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class DailyRecord(Base):
    __tablename__ = "daily_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    steps = Column(Integer, default=0)
    sleep_hours = Column(Float, default=0.0)
    screen_time = Column(Float, default=0.0)
    exercise_minutes = Column(Integer, default=0)
    water_intake = Column(Float, default=0.0) # In Litres
    mood = Column(String(50), default="Neutral") # Great, Good, Neutral, Tired, Stressed, Energetic
    energy = Column(Integer, default=5) # 1 to 10
    notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_daily_date'),
    )

    user = relationship("User", back_populates="daily_records")
