from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime

EMAIL_REGEX = r"^[\w\.\+\-]+@[\w\.\-]+\.[a-zA-Z]{2,}$"

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=6)
    confirm_password: Optional[str] = None

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if v is not None and "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v

class UserLogin(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str

class UserPreferenceBase(BaseModel):
    primary_goal: Optional[str] = "Improve overall wellness and routine"
    step_target: Optional[int] = Field(8000, ge=1000, le=50000)
    sleep_target: Optional[float] = Field(8.0, ge=3.0, le=14.0)
    exercise_target: Optional[int] = Field(30, ge=0, le=300)
    water_target: Optional[float] = Field(2.5, ge=0.5, le=10.0)
    screen_time_limit: Optional[float] = Field(4.0, ge=0.5, le=16.0)
    preferred_sleep_time: Optional[str] = "23:00"
    ai_consent: Optional[bool] = True
    notification_preferences: Optional[str] = '{"daily_summary": true, "smart_nudges": true, "goal_alerts": true}'
    onboarding_completed: Optional[bool] = False

class UserPreferenceUpdate(BaseModel):
    primary_goal: Optional[str] = None
    step_target: Optional[int] = None
    sleep_target: Optional[float] = None
    exercise_target: Optional[int] = None
    water_target: Optional[float] = None
    screen_time_limit: Optional[float] = None
    preferred_sleep_time: Optional[str] = None
    ai_consent: Optional[bool] = None
    notification_preferences: Optional[str] = None
    onboarding_completed: Optional[bool] = None

class UserPreferenceResponse(BaseModel):
    id: int
    user_id: int
    primary_goal: str
    step_target: int
    sleep_target: float
    exercise_target: int
    water_target: float
    screen_time_limit: float
    preferred_sleep_time: str
    ai_consent: bool
    notification_preferences: str
    onboarding_completed: bool

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: Optional[datetime] = None
    preferences: Optional[UserPreferenceResponse] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
