from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.schemas.insight import InsightResponse
from app.schemas.nudge import NudgeResponse
from app.schemas.record import DailyRecordResponse

class MetricCard(BaseModel):
    metric: str
    label: str
    current_value: float
    target_value: float
    unit: str
    percentage: float
    change_pct: float
    trend: str # "up", "down", "neutral"
    status: str # "good", "warning", "attention"

class ScoreBreakdown(BaseModel):
    category: str
    score: float
    max_score: float
    rating: str
    description: str

class IntelligenceScore(BaseModel):
    overall_score: int
    level: str
    rating: str
    explanation: str
    breakdown: List[ScoreBreakdown]
    historical_change: float
    disclaimer: str = "Application-generated lifestyle-awareness indicator, not a clinically validated health score."

class TrendPoint(BaseModel):
    date: str
    day: str
    steps: int
    sleep_hours: float
    screen_time: float
    exercise_minutes: int
    water_intake: float
    energy: int

class LiveAlert(BaseModel):
    id: str
    type: str # "step_incomplete", "sleep_incomplete", "screen_warning", "screen_exceeded"
    severity: str # "warning", "danger", "info"
    title: str
    message: str
    action_label: Optional[str] = None

class DashboardResponse(BaseModel):
    greeting: str
    current_date: str
    motivational_message: str
    metrics: Dict[str, MetricCard]
    intelligence_score: IntelligenceScore
    recent_insights: List[InsightResponse]
    active_nudges: List[NudgeResponse]
    today_record: Optional[DailyRecordResponse] = None
    data_days_count: int
    live_alerts: List[LiveAlert] = []
