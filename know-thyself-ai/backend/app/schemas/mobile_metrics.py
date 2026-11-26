from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime

class MobileMetricsData(BaseModel):
    steps: Optional[int] = Field(None, ge=0, description="Cumulative daily steps count")
    screen_time_minutes: Optional[float] = Field(None, ge=0, description="Cumulative daily screen time in minutes")
    sleep_minutes: Optional[float] = Field(None, ge=0, description="Completed sleep session in minutes")
    exercise_minutes: Optional[int] = Field(None, ge=0, description="Workout duration in minutes")
    water_ml: Optional[float] = Field(None, ge=0, description="Accumulated water intake in millilitres")

class MobileMetricsAvailability(BaseModel):
    steps: bool = True
    screen_time: bool = True
    sleep: bool = False
    exercise: bool = False
    hydration: bool = True

class MobileSyncPayload(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=100)
    recorded_at: Optional[str] = Field(None, description="ISO-8601 timestamp string of measurement")
    source: Optional[str] = Field("android", description="Telemetry source identifier")
    metrics: MobileMetricsData
    available: Optional[MobileMetricsAvailability] = None
    sync_id: Optional[str] = Field(None, description="Idempotency key to prevent double-counting")

class MobileConnectRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=100)
    device_name: Optional[str] = Field("Android Phone", max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    os_version: Optional[str] = Field(None, max_length=50)
    app_version: Optional[str] = Field("1.0.0", max_length=50)
    pairing_code: Optional[str] = Field(None, max_length=20)

class MobileDeviceResponse(BaseModel):
    id: int
    device_id: str
    device_name: str
    model: Optional[str] = None
    os_version: Optional[str] = None
    is_connected: bool
    last_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

    model_config = ConfigDict(from_attributes=True)

class MobileStatusResponse(BaseModel):
    is_connected: bool
    devices: List[MobileDeviceResponse]
    active_device_count: int
    last_sync_at: Optional[datetime] = None
    today_synced_summary: Dict[str, Any]

class MobileSyncResponse(BaseModel):
    status: str = "success"
    message: str
    synced_at: datetime
    device_id: str
    current_metrics: Dict[str, Any]
    intelligence_score: Optional[int] = None

class PairingCodeResponse(BaseModel):
    pairing_code: str
    expires_in_seconds: int
    expires_at: datetime
    server_url: str

class WebSocketTicketResponse(BaseModel):
    ticket: str
    expires_in_seconds: int
    ws_url: str
