from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime
from database import get_db
from app.models.user import User, UserPreference
from app.models.record import DailyRecord
from app.models.goal import Goal
from app.models.insight import Insight
from app.models.nudge import Nudge
from app.models.chat import ChatHistory
from app.models.mobile_device import MobileDevice, MobileMetricLog
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/privacy", tags=["Privacy and Data Ownership"])

@router.get("/export")
def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = current_user.preferences
    records = db.query(DailyRecord).filter(DailyRecord.user_id == current_user.id).order_by(DailyRecord.date.asc()).all()
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()
    insights = db.query(Insight).filter(Insight.user_id == current_user.id).all()
    nudges = db.query(Nudge).filter(Nudge.user_id == current_user.id).all()
    chats = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).all()
    devices = db.query(MobileDevice).filter(MobileDevice.user_id == current_user.id).all()
    mobile_logs = db.query(MobileMetricLog).filter(MobileMetricLog.user_id == current_user.id).order_by(MobileMetricLog.recorded_at.desc()).limit(200).all()

    export_payload = {
        "export_metadata": {
            "app": "Know Thyself AI",
            "version": "1.0.0",
            "export_date": datetime.now().isoformat(),
            "user_id": current_user.id,
            "user_email": current_user.email
        },
        "user_profile": {
            "name": current_user.name,
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "preferences": {
            "primary_goal": pref.primary_goal if pref else None,
            "step_target": pref.step_target if pref else None,
            "sleep_target": pref.sleep_target if pref else None,
            "exercise_target": pref.exercise_target if pref else None,
            "water_target": pref.water_target if pref else None,
            "screen_time_limit": pref.screen_time_limit if pref else None,
            "preferred_sleep_time": pref.preferred_sleep_time if pref else None,
            "ai_consent": pref.ai_consent if pref else True
        },
        "daily_records": [
            {
                "id": r.id,
                "date": r.date,
                "steps": r.steps,
                "sleep_hours": r.sleep_hours,
                "screen_time": r.screen_time,
                "exercise_minutes": r.exercise_minutes,
                "water_intake": r.water_intake,
                "mood": r.mood,
                "energy": r.energy,
                "notes": r.notes,
                "is_synthetic": r.is_synthetic
            }
            for r in records
        ],
        "goals": [
            {"id": g.id, "metric": g.metric, "title": g.title, "target_value": g.target_value, "status": g.status}
            for g in goals
        ],
        "insights": [
            {"id": i.id, "title": i.title, "observation": i.observation, "evidence": i.evidence, "recommendation": i.recommendation}
            for i in insights
        ],
        "chat_history": [
            {"id": c.id, "question": c.question, "answer": c.answer, "created_at": c.created_at.isoformat() if c.created_at else None}
            for c in chats
        ],
        "mobile_devices": [
            {
                "id": d.id,
                "device_id": d.device_id,
                "device_name": d.device_name,
                "model": d.model,
                "is_connected": d.is_connected,
                "last_sync_at": d.last_sync_at.isoformat() if d.last_sync_at else None
            }
            for d in devices
        ],
        "mobile_telemetry_logs": [
            {
                "id": ml.id,
                "metric_type": ml.metric_type,
                "metric_value": ml.metric_value,
                "unit": ml.unit,
                "source": ml.source,
                "recorded_at": ml.recorded_at.isoformat() if ml.recorded_at else None
            }
            for ml in mobile_logs
        ]
    }
    return export_payload

@router.delete("/data")
def delete_all_user_lifestyle_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Transaction-safe deletion of lifestyle records
        records_deleted = db.query(DailyRecord).filter(DailyRecord.user_id == current_user.id).delete()
        insights_deleted = db.query(Insight).filter(Insight.user_id == current_user.id).delete()
        nudges_deleted = db.query(Nudge).filter(Nudge.user_id == current_user.id).delete()
        chats_deleted = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
        goals_deleted = db.query(Goal).filter(Goal.user_id == current_user.id).delete()
        mobile_logs_deleted = db.query(MobileMetricLog).filter(MobileMetricLog.user_id == current_user.id).delete()
        devices_deleted = db.query(MobileDevice).filter(MobileDevice.user_id == current_user.id).delete()
        
        db.commit()
        return {
            "success": True,
            "message": "All personal records, insights, goals, mobile telemetry, and chat histories have been permanently deleted.",
            "deleted_counts": {
                "daily_records": records_deleted,
                "insights": insights_deleted,
                "nudges": nudges_deleted,
                "chat_history": chats_deleted,
                "goals": goals_deleted,
                "mobile_logs": mobile_logs_deleted,
                "mobile_devices": devices_deleted
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database transaction error during deletion: {str(e)}"
        )

@router.delete("/account")
def delete_user_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Cascading delete will remove all associated user data
        db.delete(current_user)
        db.commit()
        return {"success": True, "message": "User account and all associated personal data permanently removed."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@router.post("/consent")
def update_ai_consent(
    consent: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = current_user.preferences
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
    pref.ai_consent = consent
    db.commit()
    return {
        "success": True,
        "ai_consent": consent,
        "message": "AI processing consent successfully updated."
    }
