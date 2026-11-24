from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Nudge(Base):
    __tablename__ = "nudges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    category = Column(String(50), default="wellness") # movement, sleep, screen, hydration, routine
    status = Column(String(20), default="pending") # pending, completed, dismissed
    action_label = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="nudges")
