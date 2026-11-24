from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    observation = Column(Text, nullable=False)
    evidence = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    category = Column(String(50), default="general") # activity, sleep, screen_time, wellness, routine
    confidence = Column(String(50), default="High") # High, Moderate, Preliminary
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="insights")
