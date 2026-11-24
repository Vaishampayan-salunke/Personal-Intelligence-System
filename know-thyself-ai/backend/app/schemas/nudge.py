from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NudgeBase(BaseModel):
    message: str
    category: str = "wellness" # movement, sleep, screen, hydration, routine
    status: str = "pending" # pending, completed, dismissed
    action_label: Optional[str] = None

class NudgeCreate(NudgeBase):
    pass

class NudgeUpdate(BaseModel):
    status: str = Field(..., pattern="^(completed|dismissed|pending)$")

class NudgeResponse(NudgeBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
