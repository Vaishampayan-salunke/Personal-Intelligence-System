from typing import List, Dict, Any, Optional
from datetime import datetime, date
from app.models.record import DailyRecord
from app.models.user import UserPreference
from app.models.nudge import Nudge

def generate_smart_nudges_for_user(
    records: List[DailyRecord],
    preferences: Optional[UserPreference] = None,
    existing_nudges: Optional[List[Nudge]] = None
) -> List[Dict[str, Any]]:
    nudges = []
    
    today_str = date.today().strftime("%Y-%m-%d")
    has_today_entry = any(r.date == today_str for r in records)
    
    # 1. Reminder to update daily data if not done
    if not has_today_entry:
        nudges.append({
            "message": "You haven't logged today's activities yet. Take 60 seconds to record your steps and sleep!",
            "category": "routine",
            "action_label": "Log Today's Data"
        })

    if not records:
        return nudges

    sorted_records = sorted(records, key=lambda r: r.date)
    recent_recs = sorted_records[-7:]
    latest = sorted_records[-1]

    step_target = preferences.step_target if preferences else 8000
    sleep_target = preferences.sleep_target if preferences else 8.0
    screen_limit = preferences.screen_time_limit if preferences else 4.0
    exercise_target = preferences.exercise_target if preferences else 30

    # 2. Activity / Movement Nudge
    if latest.steps < (step_target * 0.7):
        nudges.append({
            "message": f"You're at {latest.steps:,} steps today. A refreshing 15-minute walk will easily add 1,500+ steps toward your {step_target:,} target.",
            "category": "movement",
            "action_label": "Take a 15-Min Walk"
        })
    elif latest.steps >= step_target:
        nudges.append({
            "message": f"Outstanding effort! You've reached your daily movement goal of {step_target:,} steps.",
            "category": "movement",
            "action_label": "Celebrate Victory"
        })

    # 3. Screen Time Nudge
    if latest.screen_time > screen_limit:
        excess = round(latest.screen_time - screen_limit, 1)
        nudges.append({
            "message": f"Screen time today has reached {latest.screen_time}h ({excess}h over your healthy limit). Consider resting your eyes with the 20-20-20 rule.",
            "category": "screen",
            "action_label": "Digital Break"
        })

    # 4. Sleep Regularity Nudge
    if len(recent_recs) >= 3:
        avg_recent_sleep = sum(r.sleep_hours for r in recent_recs) / len(recent_recs)
        if avg_recent_sleep < 6.5:
            bedtime = preferences.preferred_sleep_time if preferences else "23:00"
            nudges.append({
                "message": f"Your sleep has averaged {round(avg_recent_sleep, 1)}h over the last few nights. Plan to dim lights and unwind by {bedtime} tonight.",
                "category": "sleep",
                "action_label": "Evening Wind-Down"
            })

    # 5. Hydration Nudge
    if latest.water_intake < (preferences.water_target if preferences else 2.5) * 0.6:
        nudges.append({
            "message": "Hydration check: replenish with a fresh glass of water to maintain afternoon cognitive sharpness.",
            "category": "hydration",
            "action_label": "Drink Water"
        })

    # 6. Default encouraging nudge if user is in a balanced state
    if not nudges:
        nudges.append({
            "message": f"You're at {latest.steps:,} steps today. A quick 15-minute pacing session will help you hit your {step_target:,} daily goal!",
            "category": "movement",
            "action_label": "Keep Moving"
        })

    # Filter out messages that already exist in pending state
    existing_messages = {n.message for n in (existing_nudges or []) if n.status == "pending"}
    fresh_nudges = [n for n in nudges if n["message"] not in existing_messages]
    
    return fresh_nudges
