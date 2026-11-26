import time
import secrets
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.mobile_device import MobileDevice, MobileMetricLog
from app.models.record import DailyRecord
from app.models.user import User, UserPreference
from app.schemas.mobile_metrics import MobileSyncPayload, MobileSyncResponse
from app.services.analytics import calculate_analytics
from app.services.websocket_manager import ws_manager

# Temporary pairing code store: code -> {"user_id": int, "expires_at": float}
PAIRING_CODES: Dict[str, Dict[str, Any]] = {}

def create_pairing_code(user_id: int, expires_in_seconds: int = 600) -> Dict[str, Any]:
    """Generate a 6-digit numeric pairing code valid for 10 minutes."""
    _cleanup_expired_pairing_codes()
    # 6-digit numeric code for easy entry on phone
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + expires_in_seconds
    PAIRING_CODES[code] = {
        "user_id": user_id,
        "expires_at": expires_at
    }
    return {
        "pairing_code": code,
        "expires_in_seconds": expires_in_seconds,
        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc)
    }

def verify_and_consume_pairing_code(code: str) -> Optional[int]:
    """Validate 6-digit pairing code and consume it."""
    _cleanup_expired_pairing_codes()
    cleaned = code.strip()
    if cleaned not in PAIRING_CODES:
        return None
    data = PAIRING_CODES.pop(cleaned)
    if time.time() > data["expires_at"]:
        return None
    return data["user_id"]

def _cleanup_expired_pairing_codes():
    now = time.time()
    expired = [c for c, data in PAIRING_CODES.items() if now > data["expires_at"]]
    for c in expired:
        PAIRING_CODES.pop(c, None)

async def process_mobile_sync(
    payload: MobileSyncPayload,
    user_id: int,
    db: Session
) -> MobileSyncResponse:
    """
    Process incoming metrics from an Android device:
    - Avoid duplicate processing using sync_id idempotency
    - Store detailed audit logs in MobileMetricLog
    - Update today's DailyRecord cumulatively without overwriting historical measurements
    - Update MobileDevice connection and last_sync_at
    - Recalculate intelligence score
    - Broadcast WebSocket live event to connected web clients
    """
    # 1. Ensure MobileDevice record exists or is updated
    device = db.query(MobileDevice).filter(
        MobileDevice.user_id == user_id,
        MobileDevice.device_id == payload.device_id
    ).first()

    now_utc = datetime.now(timezone.utc)
    today_str = date.today().strftime("%Y-%m-%d")

    if not device:
        device = MobileDevice(
            user_id=user_id,
            device_id=payload.device_id,
            device_name="Android Phone",
            is_connected=True,
            last_sync_at=now_utc
        )
        db.add(device)
    else:
        device.is_connected = True
        device.last_sync_at = now_utc

    # 2. Check for duplicate sync_id if provided
    if payload.sync_id:
        existing_log = db.query(MobileMetricLog).filter(
            MobileMetricLog.user_id == user_id,
            MobileMetricLog.sync_id.like(f"{payload.sync_id}%")
        ).first()
        if existing_log:
            # Already processed this exact batch
            return MobileSyncResponse(
                status="success",
                message="Duplicate sync payload acknowledged (idempotent)",
                synced_at=now_utc,
                device_id=payload.device_id,
                current_metrics={"status": "already_processed"}
            )

    # 3. Find or create today's DailyRecord for this user
    today_record = db.query(DailyRecord).filter(
        DailyRecord.user_id == user_id,
        DailyRecord.date == today_str
    ).first()

    if not today_record:
        today_record = DailyRecord(
            user_id=user_id,
            date=today_str,
            steps=0,
            sleep_hours=0.0,
            screen_time=0.0,
            exercise_minutes=0,
            water_intake=0.0,
            mood="Good",
            energy=7,
            is_synthetic=False
        )
        db.add(today_record)
        db.flush()

    # 4. Process each individual metric
    m = payload.metrics
    recorded_dt = now_utc
    if payload.recorded_at:
        try:
            recorded_dt = datetime.fromisoformat(payload.recorded_at)
        except Exception:
            recorded_dt = now_utc

    # Steps (cumulative count)
    if m.steps is not None and m.steps > 0:
        # Save audit log
        log_steps = MobileMetricLog(
            user_id=user_id,
            device_id=payload.device_id,
            recorded_at=recorded_dt,
            metric_type="steps",
            metric_value=float(m.steps),
            unit="count",
            source="android_sensor",
            sync_id=f"{payload.sync_id}_steps" if payload.sync_id else None
        )
        db.add(log_steps)
        # Update daily record cumulatively
        today_record.steps = max(today_record.steps, m.steps)

    # Screen time (cumulative minutes converted to hours)
    if m.screen_time_minutes is not None and m.screen_time_minutes > 0:
        log_screen = MobileMetricLog(
            user_id=user_id,
            device_id=payload.device_id,
            recorded_at=recorded_dt,
            metric_type="screen_time",
            metric_value=float(m.screen_time_minutes),
            unit="minutes",
            source="android_usagestats",
            sync_id=f"{payload.sync_id}_screen" if payload.sync_id else None
        )
        db.add(log_screen)
        hours = round(m.screen_time_minutes / 60.0, 2)
        today_record.screen_time = max(today_record.screen_time, hours)

    # Sleep (minutes converted to hours)
    if m.sleep_minutes is not None and m.sleep_minutes > 0:
        log_sleep = MobileMetricLog(
            user_id=user_id,
            device_id=payload.device_id,
            recorded_at=recorded_dt,
            metric_type="sleep",
            metric_value=float(m.sleep_minutes),
            unit="minutes",
            source="android_healthconnect",
            sync_id=f"{payload.sync_id}_sleep" if payload.sync_id else None
        )
        db.add(log_sleep)
        s_hours = round(m.sleep_minutes / 60.0, 2)
        today_record.sleep_hours = s_hours

    # Exercise (minutes)
    if m.exercise_minutes is not None and m.exercise_minutes > 0:
        log_ex = MobileMetricLog(
            user_id=user_id,
            device_id=payload.device_id,
            recorded_at=recorded_dt,
            metric_type="exercise",
            metric_value=float(m.exercise_minutes),
            unit="minutes",
            source="android_healthconnect",
            sync_id=f"{payload.sync_id}_exercise" if payload.sync_id else None
        )
        db.add(log_ex)
        today_record.exercise_minutes = max(today_record.exercise_minutes, m.exercise_minutes)

    # Hydration (millilitres converted to litres)
    if m.water_ml is not None and m.water_ml > 0:
        log_water = MobileMetricLog(
            user_id=user_id,
            device_id=payload.device_id,
            recorded_at=recorded_dt,
            metric_type="water",
            metric_value=float(m.water_ml),
            unit="ml",
            source="android_hydration",
            sync_id=f"{payload.sync_id}_water" if payload.sync_id else None
        )
        db.add(log_water)
        w_litres = round(m.water_ml / 1000.0, 2)
        today_record.water_intake = max(today_record.water_intake, w_litres)

    db.commit()
    db.refresh(today_record)

    # 5. Calculate updated Intelligence Score
    all_records = db.query(DailyRecord).filter(DailyRecord.user_id == user_id).all()
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    analytics = calculate_analytics(all_records, pref)
    score_val = analytics.get("score", {}).get("overall_score", 70)

    current_summary = {
        "date": today_record.date,
        "steps": today_record.steps,
        "screen_time": today_record.screen_time,
        "sleep_hours": today_record.sleep_hours,
        "exercise_minutes": today_record.exercise_minutes,
        "water_intake": today_record.water_intake,
        "mood": today_record.mood,
        "energy": today_record.energy
    }

    # 6. Broadcast Real-Time WebSocket Event
    ws_event = {
        "type": "metrics_update",
        "data": {
            "device_id": payload.device_id,
            "metrics": current_summary,
            "intelligence_score": score_val,
            "score_breakdown": analytics.get("score", {}).get("breakdown", []),
            "last_synced_at": now_utc.isoformat(),
            "source": payload.source or "android"
        },
        "updated_at": now_utc.isoformat()
    }

    await ws_manager.broadcast_to_user(user_id, ws_event)

    return MobileSyncResponse(
        status="success",
        message="Metrics synchronized and broadcast successfully",
        synced_at=now_utc,
        device_id=payload.device_id,
        current_metrics=current_summary,
        intelligence_score=score_val
    )
