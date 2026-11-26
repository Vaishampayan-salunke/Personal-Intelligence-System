from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime, date, timedelta
from database import get_db
from app.models.user import User, UserPreference
from app.models.record import DailyRecord
from app.models.insight import Insight
from app.models.nudge import Nudge
from app.schemas.dashboard import DashboardResponse, MetricCard, IntelligenceScore, LiveAlert
from app.schemas.record import DailyRecordResponse
from app.services.analytics import calculate_analytics
from app.services.ai_engine import generate_fallback_insights
from app.services.nudge_engine import generate_smart_nudges_for_user
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

MOTIVATIONAL_MESSAGES = [
    "Small daily habits compound into massive long-term transformations.",
    "Understanding your baseline is the first step toward masterly self-regulation.",
    "Listen to your rhythms: energy flows where attention goes.",
    "Consistency over perfection: every logged day is self-awareness earned.",
    "Prioritize your recovery as intentionally as your daily output."
]

@router.get("", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch all records for the user ordered by date
    records = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.asc()).all()

    pref = current_user.preferences

    # Calculate rich analytics and Personal Intelligence Score
    analytics = calculate_analytics(records, pref)

    # Today record check
    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = next((r for r in reversed(records) if r.date == today_str), None)
    latest_rec = records[-1] if records else None

    # Greeting
    first_name = current_user.name.split()[0] if current_user.name else "Friend"
    now_hour = datetime.now().hour
    if now_hour < 12:
        greeting = f"Good morning, {first_name}"
    elif now_hour < 17:
        greeting = f"Good afternoon, {first_name}"
    else:
        greeting = f"Good evening, {first_name}"

    current_date_str = datetime.now().strftime("%A, %B %d, %Y")
    day_idx = datetime.now().day % len(MOTIVATIONAL_MESSAGES)
    motive_msg = MOTIVATIONAL_MESSAGES[day_idx]

    # Target settings
    step_target = pref.step_target if pref else 8000
    sleep_target = pref.sleep_target if pref else 8.0
    screen_limit = pref.screen_time_limit if pref else 4.0
    exercise_target = pref.exercise_target if pref else 30
    water_target = pref.water_target if pref else 2.5

    # Values for current overview cards (today's entry or latest logged day)
    disp_rec = today_rec or latest_rec
    c_steps = float(disp_rec.steps) if disp_rec else 0.0
    c_sleep = float(disp_rec.sleep_hours) if disp_rec else 0.0
    c_screen = float(disp_rec.screen_time) if disp_rec else 0.0
    c_exercise = float(disp_rec.exercise_minutes) if disp_rec else 0.0
    c_water = float(disp_rec.water_intake) if disp_rec else 0.0
    c_energy = float(disp_rec.energy) if disp_rec else 0.0

    changes = analytics.get("changes_pct", {})

    metrics = {
        "steps": MetricCard(
            metric="steps",
            label="Daily Steps",
            current_value=c_steps,
            target_value=float(step_target),
            unit="steps",
            percentage=round(min(c_steps / step_target * 100, 150), 1) if step_target else 0,
            change_pct=changes.get("steps", 0.0),
            trend="up" if changes.get("steps", 0.0) >= 0 else "down",
            status="good" if c_steps >= step_target else ("warning" if c_steps >= step_target * 0.7 else "attention")
        ),
        "sleep": MetricCard(
            metric="sleep",
            label="Sleep Duration",
            current_value=c_sleep,
            target_value=float(sleep_target),
            unit="hrs",
            percentage=round(min(c_sleep / sleep_target * 100, 150), 1) if sleep_target else 0,
            change_pct=changes.get("sleep_hours", 0.0),
            trend="up" if changes.get("sleep_hours", 0.0) >= 0 else "down",
            status="good" if c_sleep >= 7.0 else ("warning" if c_sleep >= 6.0 else "attention")
        ),
        "screen_time": MetricCard(
            metric="screen_time",
            label="Screen Time",
            current_value=c_screen,
            target_value=float(screen_limit),
            unit="hrs",
            percentage=round((c_screen / screen_limit * 100), 1) if screen_limit else 0,
            change_pct=changes.get("screen_time", 0.0),
            trend="down" if changes.get("screen_time", 0.0) <= 0 else "up",
            status="good" if c_screen <= screen_limit else ("warning" if c_screen <= screen_limit * 1.3 else "attention")
        ),
        "exercise": MetricCard(
            metric="exercise",
            label="Exercise Active",
            current_value=c_exercise,
            target_value=float(exercise_target),
            unit="min",
            percentage=round(min(c_exercise / exercise_target * 100, 200), 1) if exercise_target else 0,
            change_pct=changes.get("exercise_minutes", 0.0),
            trend="up" if changes.get("exercise_minutes", 0.0) >= 0 else "down",
            status="good" if c_exercise >= exercise_target else "warning"
        ),
        "water": MetricCard(
            metric="water",
            label="Hydration Intake",
            current_value=c_water,
            target_value=float(water_target),
            unit="L",
            percentage=round(min(c_water / water_target * 100, 150), 1) if water_target else 0,
            change_pct=changes.get("water_intake", 0.0),
            trend="up" if changes.get("water_intake", 0.0) >= 0 else "down",
            status="good" if c_water >= water_target * 0.8 else "warning"
        ),
        "energy": MetricCard(
            metric="energy",
            label="Energy & Vitality",
            current_value=c_energy,
            target_value=10.0,
            unit="/10",
            percentage=round(c_energy * 10, 1),
            change_pct=changes.get("energy", 0.0),
            trend="up" if changes.get("energy", 0.0) >= 0 else "down",
            status="good" if c_energy >= 7 else ("warning" if c_energy >= 5 else "attention")
        )
    }

    # Generate Real-Time Health & Routine Alert Messages
    live_alerts: List[LiveAlert] = []

    # --- REAL-TIME LIFESTYLE ALERTS ---
    if disp_rec:
        # 1. Daily Steps Alert
        if c_steps < step_target:
            diff_steps = int(step_target - c_steps)
            live_alerts.append(LiveAlert(
                id="alert-step-incomplete",
                type="step_incomplete",
                severity="warning",
                title="Daily Step Target Incomplete",
                message=f"You have reached {int(c_steps):,} of {step_target:,} steps today ({diff_steps:,} steps remaining). Take a brisk walk or connect your phone to track steps live!",
                action_label="Take 15m Walk"
            ))
        else:
            live_alerts.append(LiveAlert(
                id="alert-step-completed",
                type="step_completed",
                severity="info",
                title="Daily Step Goal Crushed!",
                message=f"Outstanding! You've logged {int(c_steps):,} steps today, beating your {step_target:,} target.",
                action_label="Celebrate"
            ))

        # 2. Incomplete Sleep Cycle Alert (only if sleep was logged > 0)
        if 0 < c_sleep < 7.0:
            live_alerts.append(LiveAlert(
                id="alert-sleep-incomplete",
                type="sleep_incomplete",
                severity="danger" if c_sleep < 6.0 else "warning",
                title="Incomplete Sleep Cycle Warning",
                message=f"Only {c_sleep}h of sleep logged (target: {sleep_target}h). Deep REM and recovery cycles were interrupted. Wind down earlier tonight by {pref.preferred_sleep_time if pref else '22:45'}.",
                action_label="Evening Wind-Down"
            ))

        # 3. Screen Time Warning (Approaching limit or Exceeded)
        if c_screen > screen_limit:
            excess_sc = round(c_screen - screen_limit, 1)
            live_alerts.append(LiveAlert(
                id="alert-screen-exceeded",
                type="screen_exceeded",
                severity="danger",
                title="Screen Time Budget Exceeded",
                message=f"Daily device screen usage is at {c_screen}h (+{excess_sc}h over your {screen_limit}h healthy ceiling). Excessive evening blue light delays melatonin; take a digital detox break.",
                action_label="Digital Detox"
            ))
        elif c_screen >= (screen_limit * 0.75) and c_screen > 0:
            rem_sc = round(screen_limit - c_screen, 1)
            live_alerts.append(LiveAlert(
                id="alert-screen-warning",
                type="screen_warning",
                severity="warning",
                title="Screen Time Approaching Limit",
                message=f"You have used {c_screen}h of your {screen_limit}h daily limit ({int(c_screen/screen_limit*100)}%). Only {rem_sc}h remaining. Practice the 20-20-20 eye relief rule.",
                action_label="Rest Eyes"
            ))
    else:
        live_alerts.append(LiveAlert(
            id="alert-welcome-fresh",
            type="fresh_start",
            severity="info",
            title="Fresh Real-Time Account Ready",
            message="Your account is completely fresh with 0 recorded data. Open this site on your Android phone or click 'Connect Phone' to stream live pedometer steps and screen time!",
            action_label="Connect Phone"
        ))

    # Retrieve recent insights or generate fallback if none exists yet
    user_insights = db.query(Insight).filter(
        Insight.user_id == current_user.id
    ).order_by(Insight.created_at.desc()).limit(5).all()

    if not user_insights and records:
        fallback_items = generate_fallback_insights(analytics, pref)
        for fi in fallback_items:
            ins_obj = Insight(
                user_id=current_user.id,
                title=fi.title,
                observation=fi.observation,
                evidence=fi.evidence,
                explanation=fi.explanation,
                recommendation=fi.recommendation,
                category=fi.category,
                confidence=fi.confidence
            )
            db.add(ins_obj)
        db.commit()
        user_insights = db.query(Insight).filter(
            Insight.user_id == current_user.id
        ).order_by(Insight.created_at.desc()).limit(5).all()

    # Active smart nudges (auto-generate if fewer than 2 active)
    active_nudges = db.query(Nudge).filter(
        Nudge.user_id == current_user.id,
        Nudge.status == "pending"
    ).order_by(Nudge.created_at.desc()).limit(4).all()

    if len(active_nudges) < 2 and records:
        fresh_nudges = generate_smart_nudges_for_user(records, pref, active_nudges)
        for fn in fresh_nudges:
            n_obj = Nudge(
                user_id=current_user.id,
                message=fn["message"],
                category=fn.get("category", "wellness"),
                status="pending",
                action_label=fn.get("action_label")
            )
            db.add(n_obj)
        db.commit()
        active_nudges = db.query(Nudge).filter(
            Nudge.user_id == current_user.id,
            Nudge.status == "pending"
        ).order_by(Nudge.created_at.desc()).limit(4).all()

    score_data = analytics["score"]

    return DashboardResponse(
        greeting=greeting,
        current_date=current_date_str,
        motivational_message=motive_msg,
        metrics=metrics,
        intelligence_score=IntelligenceScore(
            overall_score=score_data["overall_score"],
            level=score_data["level"],
            rating=score_data["rating"],
            explanation=score_data["explanation"],
            breakdown=score_data["breakdown"],
            historical_change=score_data["historical_change"]
        ),
        recent_insights=user_insights,
        active_nudges=active_nudges,
        today_record=today_rec,
        data_days_count=len(records),
        live_alerts=live_alerts
    )

@router.get("/trends")
def get_dashboard_trends(
    days: int = 14,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.desc()).limit(days).all()

    sorted_records = list(reversed(records))
    chart_data = []
    for r in sorted_records:
        try:
            d_obj = datetime.strptime(r.date, "%Y-%m-%d")
            day_name = d_obj.strftime("%a")
            formatted_date = d_obj.strftime("%b %d")
        except ValueError:
            day_name = ""
            formatted_date = r.date

        chart_data.append({
            "date": r.date,
            "display_date": formatted_date,
            "day": day_name,
            "steps": r.steps,
            "sleep_hours": r.sleep_hours,
            "screen_time": r.screen_time,
            "exercise_minutes": r.exercise_minutes,
            "water_intake": r.water_intake,
            "energy": r.energy,
            "mood": r.mood,
            "is_synthetic": r.is_synthetic
        })

    return {
        "days": days,
        "count": len(chart_data),
        "trend_data": chart_data
    }
