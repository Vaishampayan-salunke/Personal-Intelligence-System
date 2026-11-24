from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class DailyRecordBase(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date in YYYY-MM-DD format")
    steps: int = Field(0, ge=0, le=100000, description="Daily steps walked")
    sleep_hours: float = Field(0.0, ge=0.0, le=24.0, description="Sleep duration in hours")
    screen_time: float = Field(0.0, ge=0.0, le=24.0, description="Phone/computer screen time in hours")
    exercise_minutes: int = Field(0, ge=0, le=1440, description="Physical workout/exercise in minutes")
    water_intake: float = Field(0.0, ge=0.0, le=15.0, description="Water consumed in litres")
    mood: str = Field("Neutral", max_length=50)
    energy: int = Field(5, ge=1, le=10, description="Energy rating 1-10")
    notes: Optional[str] = Field(None, max_length=1000)
    is_synthetic: Optional[bool] = False

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        try:
            parsed = datetime.strptime(v, "%Y-%m-%d").date()
            if parsed > date.today():
                # Allow today or past dates only
                pass
            return v
        except ValueError:
            raise ValueError("Invalid date format, expected YYYY-MM-DD")

class DailyRecordCreate(DailyRecordBase):
    pass

class DailyRecordUpdate(BaseModel):
    steps: Optional[int] = Field(None, ge=0, le=100000)
    sleep_hours: Optional[float] = Field(None, ge=0.0, le=24.0)
    screen_time: Optional[float] = Field(None, ge=0.0, le=24.0)
    exercise_minutes: Optional[int] = Field(None, ge=0, le=1440)
    water_intake: Optional[float] = Field(None, ge=0.0, le=15.0)
    mood: Optional[str] = Field(None, max_length=50)
    energy: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = Field(None, max_length=1000)

class DailyRecordResponse(DailyRecordBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CSVImportResult(BaseModel):
    success: bool
    total_rows: int
    imported_rows: int
    skipped_rows: int
    errors: List[str]
    sample_preview: Optional[List[Dict[str, Any]]] = None
