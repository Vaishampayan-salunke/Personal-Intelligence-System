from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class MobileDevice(Base):
    __tablename__ = "mobile_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    device_name = Column(String(100), default="Android Phone")
    model = Column(String(100), nullable=True)
    os_version = Column(String(50), nullable=True)
    app_version = Column(String(50), default="1.0.0")
    is_connected = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'device_id', name='uq_user_device'),
    )

    user = relationship("User", back_populates="mobile_devices")


class MobileMetricLog(Base):
    __tablename__ = "mobile_metric_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, index=True)
    metric_type = Column(String(50), nullable=False, index=True) # steps, screen_time, sleep, exercise, water
    metric_value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    source = Column(String(50), default="android") # android_sensor, android_usagestats, android_healthconnect, manual
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    sync_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="mobile_logs")
