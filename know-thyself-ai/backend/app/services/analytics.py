from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import math
from app.models.record import DailyRecord
from app.models.user import UserPreference

def safe_div(n: float, d: float, default: float = 0.0) -> float:
    return (n / d) if d != 0 else default

def calculate_analytics(records: List[DailyRecord], preferences: Optional[UserPreference] = None) -> Dict[str, Any]:
    if not records:
        return {
            "has_data": False,
            "total_records": 0,
            "averages": {
                "steps": 0, "sleep_hours": 0.0, "screen_time": 0.0,
                "exercise_minutes": 0, "water_intake": 0.0, "energy": 0.0
            },
            "trends": {},
            "score": {
                "overall_score": 50,
                "level": "Developing",
                "rating": "Neutral",
                "explanation": "No lifestyle records found yet. Begin logging your daily habits to unlock personalized intelligence.",
                "breakdown": [],
                "historical_change": 0.0
            }
        }

    # Sort records ascending by date
    sorted_records = sorted(records, key=lambda r: r.date)
    total_count = len(sorted_records)

    # Defaults from preferences
    step_target = preferences.step_target if preferences else 8000
    sleep_target = preferences.sleep_target if preferences else 8.0
    exercise_target = preferences.exercise_target if preferences else 30
    water_target = preferences.water_target if preferences else 2.5
    screen_limit = preferences.screen_time_limit if preferences else 4.0

    # Overall sums and averages
    sum_steps = sum(r.steps for r in sorted_records)
    sum_sleep = sum(r.sleep_hours for r in sorted_records)
    sum_screen = sum(r.screen_time for r in sorted_records)
    sum_exercise = sum(r.exercise_minutes for r in sorted_records)
    sum_water = sum(r.water_intake for r in sorted_records)
    sum_energy = sum(r.energy for r in sorted_records)

    avg_steps = round(sum_steps / total_count)
    avg_sleep = round(sum_sleep / total_count, 1)
    avg_screen = round(sum_screen / total_count, 1)
    avg_exercise = round(sum_exercise / total_count)
    avg_water = round(sum_water / total_count, 1)
    avg_energy = round(sum_energy / total_count, 1)

    # Split into recent 7 days vs previous 7 days (if available)
    recent_7 = sorted_records[-7:] if total_count >= 7 else sorted_records
    prev_7 = sorted_records[-14:-7] if total_count >= 14 else (sorted_records[:-7] if total_count > 7 else [])

    def calc_period_avgs(recs: List[DailyRecord]):
        if not recs:
            return None
        c = len(recs)
        return {
            "steps": sum(r.steps for r in recs) / c,
            "sleep_hours": sum(r.sleep_hours for r in recs) / c,
            "screen_time": sum(r.screen_time for r in recs) / c,
            "exercise_minutes": sum(r.exercise_minutes for r in recs) / c,
            "water_intake": sum(r.water_intake for r in recs) / c,
            "energy": sum(r.energy for r in recs) / c,
        }

    curr_avgs = calc_period_avgs(recent_7)
    prev_avgs = calc_period_avgs(prev_7)

    # Percentage changes
    def pct_change(curr: float, prev: Optional[float]) -> float:
        if prev is None or prev == 0:
            return 0.0
        return round(((curr - prev) / prev) * 100, 1)

    changes = {}
    if curr_avgs:
        for k in ["steps", "sleep_hours", "screen_time", "exercise_minutes", "water_intake", "energy"]:
            prev_val = prev_avgs[k] if prev_avgs else curr_avgs[k]
            changes[k] = pct_change(curr_avgs[k], prev_val)

    # Sleep consistency (Standard deviation of sleep duration in recent 7 days)
    sleep_vals = [r.sleep_hours for r in recent_7]
    if len(sleep_vals) > 1:
        mean_s = sum(sleep_vals) / len(sleep_vals)
        variance_s = sum((x - mean_s) ** 2 for x in sleep_vals) / len(sleep_vals)
        sleep_std = math.sqrt(variance_s)
    else:
        sleep_std = 0.5
    # High regularity = low std dev (< 0.75h)
    sleep_consistency_score = max(0.0, min(100.0, (1.0 - min(sleep_std / 2.0, 1.0)) * 100))

    # Activity consistency
    step_vals = [r.steps for r in recent_7]
    days_met_step_target = sum(1 for s in step_vals if s >= step_target)

    # Exercise frequency
    workout_days = sum(1 for r in recent_7 if r.exercise_minutes >= 20)

    # Calculate Personal Intelligence Score (0 to 100)
    # 1. Activity (25 points):
    act_ratio = min(curr_avgs["steps"] / step_target, 1.2) if curr_avgs else 0.5
    act_score = min(25.0, round(act_ratio * 20.8, 1))

    # 2. Sleep Quality & Consistency (25 points):
    sleep_duration_ratio = min(curr_avgs["sleep_hours"] / sleep_target, 1.1) if curr_avgs else 0.5
    # penalty if too little or excessively high
    if curr_avgs and curr_avgs["sleep_hours"] < 6.0:
        sleep_duration_ratio *= 0.8
    sleep_score = min(25.0, round((sleep_duration_ratio * 15.0) + (sleep_consistency_score / 100.0 * 10.0), 1))

    # 3. Exercise & Movement (20 points):
    ex_ratio = min(curr_avgs["exercise_minutes"] / exercise_target, 1.3) if curr_avgs else 0.5
    freq_bonus = min(workout_days / 4.0, 1.0) * 8.0
    ex_score = min(20.0, round((ex_ratio * 12.0) + freq_bonus, 1))

    # 4. Digital Balance / Screen Time (15 points):
    # Higher screen time over limit reduces points
    if curr_avgs:
        screen_ratio = curr_avgs["screen_time"] / screen_limit
        if screen_ratio <= 1.0:
            screen_score = 15.0
        elif screen_ratio <= 1.5:
            screen_score = round(15.0 - ((screen_ratio - 1.0) / 0.5 * 7.0), 1)
        else:
            screen_score = max(3.0, round(8.0 - (screen_ratio - 1.5) * 5.0, 1))
    else:
        screen_score = 10.0

    # 5. Routine & Hydration Consistency (15 points):
    water_ratio = min(curr_avgs["water_intake"] / water_target, 1.0) if curr_avgs else 0.5
    energy_factor = (curr_avgs["energy"] / 10.0) if curr_avgs else 0.5
    routine_score = min(15.0, round((water_ratio * 8.0) + (energy_factor * 7.0), 1))

    overall_score = int(round(act_score + sleep_score + ex_score + screen_score + routine_score))
    overall_score = max(5, min(100, overall_score))

    # Rating label
    if overall_score >= 85:
        level = "Optimal"
        rating = "Exceptional Balance"
        explanation = "Outstanding lifestyle synergy across activity, sleep regularity, and daily digital balance."
    elif overall_score >= 70:
        level = "Thriving"
        rating = "Healthy Habits"
        explanation = "Strong positive behavioural routines with minor opportunities to optimize sleep consistency or hydration."
    elif overall_score >= 55:
        level = "Moderate"
        rating = "Balanced Foundation"
        explanation = "Steady foundation established. Gradual improvements in daily movement and screen moderation will drive quick gains."
    else:
        level = "Developing"
        rating = "Focus Area"
        explanation = "Lifestyle indicators suggest fragmented routines. Small sustainable daily habits can significantly elevate your energy."

    breakdown = [
        {
            "category": "Physical Activity",
            "score": act_score,
            "max_score": 25.0,
            "rating": "Strong" if act_score >= 19 else ("Fair" if act_score >= 13 else "Needs Focus"),
            "description": f"Averaging {int(curr_avgs['steps']):,} steps/day vs {step_target:,} target."
        },
        {
            "category": "Sleep Quality & Rhythm",
            "score": sleep_score,
            "max_score": 25.0,
            "rating": "Regular" if sleep_score >= 19 else ("Variable" if sleep_score >= 13 else "Irregular"),
            "description": f"{curr_avgs['sleep_hours']}h/night average with {round(sleep_std, 1)}h variation."
        },
        {
            "category": "Exercise & Vitality",
            "score": ex_score,
            "max_score": 20.0,
            "rating": "Active" if ex_score >= 15 else ("Moderate" if ex_score >= 10 else "Low"),
            "description": f"{workout_days} active workout days this week ({int(curr_avgs['exercise_minutes'])} min/day)."
        },
        {
            "category": "Digital Balance",
            "score": screen_score,
            "max_score": 15.0,
            "rating": "Mindful" if screen_score >= 12 else ("Moderate" if screen_score >= 8 else "Elevated"),
            "description": f"{curr_avgs['screen_time']}h screen time vs {screen_limit}h target limit."
        },
        {
            "category": "Hydration & Energy",
            "score": routine_score,
            "max_score": 15.0,
            "rating": "Hydrated" if routine_score >= 11 else "Improving",
            "description": f"{curr_avgs['water_intake']}L water daily with {curr_avgs['energy']}/10 self-rated energy."
        }
    ]

    historical_change = round(changes.get("steps", 0) * 0.3 + changes.get("sleep_hours", 0) * 0.4, 1)

    return {
        "has_data": True,
        "total_records": total_count,
        "averages": {
            "steps": avg_steps,
            "sleep_hours": avg_sleep,
            "screen_time": avg_screen,
            "exercise_minutes": avg_exercise,
            "water_intake": avg_water,
            "energy": avg_energy
        },
        "recent_7_avgs": curr_avgs,
        "prev_7_avgs": prev_avgs,
        "changes_pct": changes,
        "sleep_std_hours": round(sleep_std, 2),
        "workout_days_7": workout_days,
        "days_met_step_target": days_met_step_target,
        "score": {
            "overall_score": overall_score,
            "level": level,
            "rating": rating,
            "explanation": explanation,
            "breakdown": breakdown,
            "historical_change": historical_change
        }
    }
