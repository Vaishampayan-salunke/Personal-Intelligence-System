from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class InsightStructured(BaseModel):
    title: str = Field(..., description="Short catchy headline for the observation")
    observation: str = Field(..., description="What was observed from the user data")
    evidence: str = Field(..., description="Quantitative metric evidence supporting this observation")
    explanation: str = Field(..., description="Why this pattern likely occurs or why it matters")
    recommendation: str = Field(..., description="Realistic, achievable lifestyle suggestion")
    category: str = Field("wellness", description="activity, sleep, screen_time, wellness, routine")
    confidence: str = Field("High", description="High, Moderate, Preliminary, or Insufficient Data")

class InsightResponse(InsightStructured):
    id: int
    user_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InsightGenerateResponse(BaseModel):
    generated_count: int
    source: str # "gemini" or "analytics-rules"
    insights: List[InsightResponse]
