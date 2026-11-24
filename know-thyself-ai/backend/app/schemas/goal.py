from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class GoalBase(BaseModel):
    metric: str = Field(..., description="steps, sleep, exercise, water, screen_time")
    title: str = Field(..., min_length=2, max_length=100)
    target_value: float = Field(..., gt=0)
    timeframe: Optional[str] = "daily" # daily, weekly
    status: Optional[str] = "active" # active, achieved, paused

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    target_value: Optional[float] = None
    timeframe: Optional[str] = None
    status: Optional[str] = None

class GoalResponse(GoalBase):
    id: int
    user_id: int
    current_value: Optional[float] = 0.0
    progress_pct: Optional[float] = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
