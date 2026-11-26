from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone

from database import get_db
from app.models.user import User
from app.models.mobile_device import MobileDevice, MobileMetricLog
from app.models.record import DailyRecord
from app.schemas.mobile_metrics import (
    MobileConnectRequest, MobileDeviceResponse, MobileStatusResponse,
    MobileSyncPayload, MobileSyncResponse, PairingCodeResponse,
    WebSocketTicketResponse
)
from app.routes.dependencies import get_current_user, get_optional_current_user
from app.core.security import create_access_token
from app.services.mobile_sync import (
    create_pairing_code, verify_and_consume_pairing_code, process_mobile_sync
)
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/mobile", tags=["Mobile Integration"])

@router.post("/pair-code", response_model=PairingCodeResponse)
def get_pairing_code(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a short-lived 6-digit numeric pairing code for pairing an Android phone.
    """
    code_data = create_pairing_code(current_user.id, expires_in_seconds=600)
    server_base = str(request.base_url).rstrip("/")
    return PairingCodeResponse(
        pairing_code=code_data["pairing_code"],
        expires_in_seconds=code_data["expires_in_seconds"],
        expires_at=code_data["expires_at"],
        server_url=server_base
    )

@router.post("/connect", response_model=MobileDeviceResponse)
def connect_device(
    connect_in: MobileConnectRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Register and pair an Android device with the authenticated account.
    Supports either direct JWT authentication or 6-digit pairing code verification.
    """
    user_id = current_user.id if current_user else None

    # If pairing code is provided, verify and resolve user
    if connect_in.pairing_code:
        resolved_user_id = verify_and_consume_pairing_code(connect_in.pairing_code)
        if not resolved_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired 6-digit pairing code. Please generate a new code from the dashboard."
            )
        user_id = resolved_user_id

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid JWT bearer token or pairing code."
        )

    device = db.query(MobileDevice).filter(
        MobileDevice.user_id == user_id,
        MobileDevice.device_id == connect_in.device_id
    ).first()

    now_utc = datetime.now(timezone.utc)

    if not device:
        device = MobileDevice(
            user_id=user_id,
            device_id=connect_in.device_id,
            device_name=connect_in.device_name or "Android Phone",
            model=connect_in.model,
            os_version=connect_in.os_version,
            app_version=connect_in.app_version or "1.0.0",
            is_connected=True,
            last_sync_at=now_utc
        )
        db.add(device)
    else:
        device.device_name = connect_in.device_name or device.device_name
        device.model = connect_in.model or device.model
        device.os_version = connect_in.os_version or device.os_version
        device.app_version = connect_in.app_version or device.app_version
        device.is_connected = True
        device.last_sync_at = now_utc

    db.commit()
    db.refresh(device)

    # Issue an access token for the companion app
    device_token = create_access_token(data={"sub": str(user_id)})
    response_data = MobileDeviceResponse.model_validate(device)
    response_data.access_token = device_token
    return response_data

@router.post("/sync", response_model=MobileSyncResponse)
async def sync_metrics(
    payload: MobileSyncPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Receive real-time and periodic telemetry from an Android device.
    Persists data in audit logs, updates daily cumulative records,
    recalculates score, and broadcasts live update via WebSockets.
    """
    return await process_mobile_sync(payload, current_user.id, db)

@router.get("/status", response_model=MobileStatusResponse)
def get_device_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return connection status, active devices, and last synchronization time.
    """
    devices = db.query(MobileDevice).filter(
        MobileDevice.user_id == current_user.id
    ).order_by(MobileDevice.updated_at.desc()).all()

    active_devices = [d for d in devices if d.is_connected]
    latest_sync = max((d.last_sync_at for d in devices if d.last_sync_at), default=None)

    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    summary = {
        "date": today_str,
        "steps": today_rec.steps if today_rec else 0,
        "screen_time": today_rec.screen_time if today_rec else 0.0,
        "sleep_hours": today_rec.sleep_hours if today_rec else 0.0,
        "exercise_minutes": today_rec.exercise_minutes if today_rec else 0,
        "water_intake": today_rec.water_intake if today_rec else 0.0
    }

    return MobileStatusResponse(
        is_connected=len(active_devices) > 0,
        devices=devices,
        active_device_count=len(active_devices),
        last_sync_at=latest_sync,
        today_synced_summary=summary
    )

@router.get("/latest")
def get_latest_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve the latest available metrics for the authenticated user.
    """
    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    latest_logs = db.query(MobileMetricLog).filter(
        MobileMetricLog.user_id == current_user.id
    ).order_by(MobileMetricLog.recorded_at.desc()).limit(10).all()

    return {
        "date": today_str,
        "daily_record": today_rec,
        "recent_telemetry": [
            {
                "type": log.metric_type,
                "value": log.metric_value,
                "unit": log.unit,
                "source": log.source,
                "recorded_at": log.recorded_at
            }
            for log in latest_logs
        ]
    }

@router.get("/history")
def get_metric_history(
    metric_type: Optional[str] = Query(None, description="Optional filter by metric type"),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve historical raw metric logs for this user with source and timestamp tracking.
    """
    q = db.query(MobileMetricLog).filter(MobileMetricLog.user_id == current_user.id)
    if metric_type:
        q = q.filter(MobileMetricLog.metric_type == metric_type)
    logs = q.order_by(MobileMetricLog.recorded_at.desc()).limit(limit).all()
    return logs

@router.delete("/disconnect")
def disconnect_device(
    device_id: Optional[str] = Query(None, description="Specific device_id to disconnect"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect / unpair an Android device.
    """
    q = db.query(MobileDevice).filter(MobileDevice.user_id == current_user.id)
    if device_id:
        q = q.filter(MobileDevice.device_id == device_id)
    devices = q.all()

    if not devices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching device found to disconnect."
        )

    for d in devices:
        d.is_connected = False

    db.commit()
    return {
        "status": "success",
        "message": f"Successfully disconnected {len(devices)} device(s)."
    }

@router.post("/ws-ticket", response_model=WebSocketTicketResponse)
def create_websocket_ticket(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a short-lived single-use ticket for authenticating WebSocket connections.
    Prevents placing permanent JWT tokens in URLs.
    """
    ticket = ws_manager.generate_ticket(current_user.id, expires_in_seconds=60)
    
    # Calculate ws:// or wss:// URL based on current request
    scheme = "wss" if request.url.scheme == "https" else "ws"
    host = request.headers.get("host") or request.url.netloc
    ws_url = f"{scheme}://{host}/ws/metrics?ticket={ticket}"

    return WebSocketTicketResponse(
        ticket=ticket,
        expires_in_seconds=60,
        ws_url=ws_url
    )
