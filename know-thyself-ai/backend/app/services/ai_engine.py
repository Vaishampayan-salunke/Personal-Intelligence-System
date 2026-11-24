import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import date
from app.core.config import settings
from app.schemas.insight import InsightStructured
from app.services.analytics import calculate_analytics
from app.models.record import DailyRecord
from app.models.user import UserPreference

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are Know Thyself AI, a friendly, deeply empathetic, intelligent, and humanized Android-style personal health & lifestyle companion.
CORE PRINCIPLES:
1. Speak in a warm, encouraging, conversational, humanized tone (like an attentive coach on the user's phone). Address them naturally!
2. Answer using the EXACT verified numbers from the supplied user metrics. If asked about today's steps or sleep, give the exact figures.
3. NEVER invent numbers or claim to access sensors that aren't logged.
4. Distinguish correlation from causation. Never diagnose medical illnesses or prescribe clinical medicines.
5. Provide actionable, practical lifestyle advice that feels supportive and achievable.
6. If the user asks about today's steps or sleep, check today's record directly and clearly state how close they are to their goal.
"""

def generate_fallback_insights(analytics: Dict[str, Any], preferences: Optional[UserPreference] = None) -> List[InsightStructured]:
    insights = []
    
    curr = analytics.get("recent_7_avgs") or analytics.get("averages", {
        "steps": 7200, "sleep_hours": 7.0, "screen_time": 4.0, "exercise_minutes": 25, "water_intake": 2.2, "energy": 7.0
    })
    changes = analytics.get("changes_pct", {})
    step_target = preferences.step_target if preferences else 8000
    sleep_target = preferences.sleep_target if preferences else 8.0
    screen_limit = preferences.screen_time_limit if preferences else 4.0
    water_target = preferences.water_target if preferences else 2.5
    workout_days = analytics.get("workout_days_7", 3)
    sleep_std = analytics.get("sleep_std_hours", 0.6)

    # 1. MOVEMENT & STEPS (category: 'activity')
    step_chg = changes.get("steps", 0.0)
    avg_steps = int(curr.get("steps", 7200))
    if avg_steps >= step_target:
        insights.append(InsightStructured(
            title="Consistent Step Target Mastery",
            observation=f"You are consistently reaching your daily physical activity goal, averaging {avg_steps:,} steps/day.",
            evidence=f"Recent average: {avg_steps:,} steps/day (Target: {step_target:,} steps).",
            explanation="Regular cardiovascular movement enhances daytime alertness, circulation, and deeper evening sleep architecture.",
            recommendation=f"Maintain this strong rhythm! Try adding varied terrain or a 10-minute incline brisk walk.",
            category="activity",
            confidence="High"
        ))
    else:
        deficit = step_target - avg_steps
        insights.append(InsightStructured(
            title="Opportunity for Movement Breaks",
            observation=f"Daily step count averages {avg_steps:,} steps, leaving room for quick walking intervals.",
            evidence=f"Current average: {avg_steps:,} steps/day ({deficit:,} steps below your {step_target:,} goal).",
            explanation="Sedentary work blocks accumulate unnoticed; brief 10-15 minute movement breaks easily bridge step deficits.",
            recommendation="Schedule a 15-minute post-lunch walk or pacing phone call to effortlessly add 1,500+ steps.",
            category="activity",
            confidence="High"
        ))

    # 2. SLEEP & RHYTHM (category: 'sleep')
    avg_sleep = curr.get("sleep_hours", 7.0)
    if avg_sleep >= sleep_target and sleep_std < 1.0:
        insights.append(InsightStructured(
            title="Restorative Sleep Consistency",
            observation="Your sleep schedule demonstrates solid regularity and restorative duration.",
            evidence=f"Nightly average: {avg_sleep}h with low variation (±{sleep_std}h variance across the week).",
            explanation="Predictable sleep timing reinforces circadian stability, optimizing daytime executive focus and cellular recovery.",
            recommendation=f"Keep protecting your {preferences.preferred_sleep_time if preferences else '23:00'} bedtime buffer.",
            category="sleep",
            confidence="High"
        ))
    elif avg_sleep < 6.5:
        insights.append(InsightStructured(
            title="Sleep Debt & Recovery Window",
            observation="Nightly rest is averaging below optimal restorative benchmarks.",
            evidence=f"Current duration: {avg_sleep} hours/night vs your {sleep_target}h target.",
            explanation="Consecutive days with sub-7h sleep accumulate cognitive fatigue and elevate evening stress hormones.",
            recommendation="Shift your wind-down routine 25 minutes earlier tonight with dimmed lights and relaxing reading.",
            category="sleep",
            confidence="High"
        ))
    else:
        insights.append(InsightStructured(
            title="Circadian Sleep Rhythm Insights",
            observation=f"Nightly sleep averages {avg_sleep} hours with ±{sleep_std}h fluctuation between weekdays and weekends.",
            evidence=f"Average duration: {avg_sleep}h/night (Target: {sleep_target}h).",
            explanation="Variations greater than 1 hour disrupt Monday morning wakefulness and biological rhythms.",
            recommendation=f"Aim to keep your wake time within 45 minutes across both weekdays and weekends.",
            category="sleep",
            confidence="High"
        ))

    # 3. DIGITAL BOUNDARIES & SCREEN TIME (category: 'screen_time')
    avg_screen = curr.get("screen_time", 4.0)
    if avg_screen > screen_limit:
        excess = round(avg_screen - screen_limit, 1)
        insights.append(InsightStructured(
            title="Elevated Screen Time Detected",
            observation=f"Device screen usage is averaging {avg_screen} hours/day, exceeding your intended boundary.",
            evidence=f"Averaging {avg_screen}h/day ({excess}h above your {screen_limit}h target limit).",
            explanation="Prolonged evening screen exposure delays natural melatonin release and strains eye accommodation muscles.",
            recommendation="Institute a 30-minute screen-free buffer before sleep and take 20-second distance breaks every 20 minutes.",
            category="screen_time",
            confidence="High"
        ))
    else:
        insights.append(InsightStructured(
            title="Mindful Digital Balance",
            observation="Screen time remains comfortably within your configured digital wellbeing threshold.",
            evidence=f"Current average: {avg_screen}h/day vs {screen_limit}h target limit.",
            explanation="Mindful device moderation preserves mental bandwidth for physical workouts and relaxed recovery.",
            recommendation="Continue prioritizing screen-free meal times and morning reflection buffers.",
            category="screen_time",
            confidence="High"
        ))

    # 4. HYDRATION & ROUTINE (category: 'routine')
    avg_water = curr.get("water_intake", 2.2)
    insights.append(InsightStructured(
        title="Hydration & Cellular Vitality",
        observation=f"Daily water intake averages {avg_water}L, supporting consistent daytime stamina.",
        evidence=f"Hydration level: {avg_water}L/day compared to your {water_target}L target.",
        explanation="Hydration directly regulates blood volume, nutrient transport, and cognitive processing speed.",
        recommendation="Drink a 400ml glass of fresh water immediately upon waking to kickstart morning circulation.",
        category="routine",
        confidence="High"
    ))

    # 5. OVERALL WELLNESS & EXERCISE (category: 'wellness')
    avg_energy = curr.get("energy", 7.0)
    avg_ex = int(curr.get("exercise_minutes", 25))
    insights.append(InsightStructured(
        title="Vitality & Movement Synergy",
        observation=f"Self-rated energy averages {avg_energy}/10 across {workout_days} active workout days this week.",
        evidence=f"{avg_ex} active workout minutes/day with an overall Personal Intelligence Score of {analytics.get('score', {}).get('overall_score', 80)}/100.",
        explanation="Consistent physical movement coupled with regular hydration forms the biological foundation for sustained high energy.",
        recommendation="Celebrate your progress and maintain this balanced lifestyle cadence!",
        category="wellness",
        confidence="High"
    ))

    return insights

def generate_insights_with_ai(records: List[DailyRecord], preferences: Optional[UserPreference] = None) -> List[InsightStructured]:
    analytics = calculate_analytics(records, preferences)
    
    if not settings.GEMINI_API_KEY:
        logger.info("Using rule-based analytics insights engine.")
        return generate_fallback_insights(analytics, preferences)

    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        summary_payload = {
            "total_records": analytics["total_records"],
            "averages": analytics["averages"],
            "recent_7_avgs": analytics.get("recent_7_avgs"),
            "changes_pct": analytics.get("changes_pct"),
            "sleep_variation_std": analytics.get("sleep_std_hours"),
            "workout_days_last_7": analytics.get("workout_days_7"),
            "user_targets": {
                "step_target": preferences.step_target if preferences else 8000,
                "sleep_target": preferences.sleep_target if preferences else 8.0,
                "exercise_target": preferences.exercise_target if preferences else 30,
                "screen_time_limit": preferences.screen_time_limit if preferences else 4.0,
                "water_target": preferences.water_target if preferences else 2.5
            }
        }

        prompt = f"""Analyze the following verified personal lifestyle analytics and generate 5 distinct, high-impact behavioral insights — EXACTLY ONE FOR EACH OF THESE 5 CATEGORIES:
1. "activity" (Movement & Steps)
2. "sleep" (Sleep & Rhythm)
3. "screen_time" (Digital Boundaries)
4. "routine" (Hydration & Routine)
5. "wellness" (Wellness & Vitality)

Return ONLY valid JSON matching this schema:
[
  {{
    "title": "Short descriptive title",
    "observation": "What the metrics show",
    "evidence": "Exact numbers and percentages from the data",
    "explanation": "Why this behavioral pattern matters",
    "recommendation": "Concrete, encouraging, practical action",
    "category": "activity" | "sleep" | "screen_time" | "routine" | "wellness",
    "confidence": "High" | "Moderate" | "Preliminary"
  }}
]

USER METRICS DATA:
{json.dumps(summary_payload, indent=2)}
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "response_mime_type": "application/json",
                "temperature": 0.3
            }
        )

        raw_text = response.text.strip()
        parsed = json.loads(raw_text)
        if isinstance(parsed, list) and len(parsed) >= 3:
            # Normalize categories in response
            valid_cats = {"activity", "sleep", "screen_time", "routine", "wellness"}
            insights = []
            for item in parsed:
                cat = item.get("category", "wellness").lower()
                if "step" in cat or "move" in cat or "walk" in cat:
                    cat = "activity"
                elif "sleep" in cat or "rest" in cat:
                    cat = "sleep"
                elif "screen" in cat or "digital" in cat:
                    cat = "screen_time"
                elif "routine" in cat or "water" in cat or "hydrat" in cat:
                    cat = "routine"
                elif cat not in valid_cats:
                    cat = "wellness"
                item["category"] = cat
                insights.append(InsightStructured(**item))
            
            # Ensure every category is covered; backfill missing ones from fallback
            existing_cats = {ins.category for ins in insights}
            fallback_items = generate_fallback_insights(analytics, preferences)
            for fb in fallback_items:
                if fb.category not in existing_cats:
                    insights.append(fb)
            return insights
        else:
            return generate_fallback_insights(analytics, preferences)

    except Exception as e:
        logger.warning(f"Gemini API generation error: {e}. Falling back to rule engine.")
        return generate_fallback_insights(analytics, preferences)

def answer_user_chat_with_ai(question: str, records: List[DailyRecord], preferences: Optional[UserPreference] = None) -> Dict[str, Any]:
    analytics = calculate_analytics(records, preferences)
    
    today_str = date.today().strftime("%Y-%m-%d")
    today_rec = next((r for r in reversed(records) if r.date == today_str), None)
    latest_rec = records[-1] if records else None

    sorted_recs = sorted(records, key=lambda r: r.date)
    recent_7 = sorted_recs[-7:] if len(sorted_recs) >= 7 else sorted_recs

    step_target = preferences.step_target if preferences else 8000
    sleep_target = preferences.sleep_target if preferences else 8.0
    screen_limit = preferences.screen_time_limit if preferences else 4.0
    water_target = preferences.water_target if preferences else 2.5

    # If completely empty, provide an informative coach welcome with immediate action
    if not records:
        return {
            "answer": "Hey there! I don't see any lifestyle records in your account yet. To give you real-time personalized answers about your daily steps, sleep, screen time, and habits, click **'Load 30-Day Demo'** on the My Data page, or log your first entry above!",
            "context_summary": "0 records found.",
            "source": "analytics-fallback"
        }

    q_lower = question.lower()

    # Rule-based humanized answers for common phone-style questions
    def humanized_coach_answer(q: str) -> str:
        curr_avgs = analytics.get("recent_7_avgs") or analytics.get("averages", {})

        # Question: Today's steps (e.g. "how many steps i ahve completed tdy", "steps today", "today steps")
        if ("today" in q_lower or "tdy" in q_lower or "completed" in q_lower) and ("step" in q_lower or "walk" in q_lower):
            steps_today = today_rec.steps if today_rec else (latest_rec.steps if latest_rec else 0)
            diff = step_target - steps_today
            if steps_today >= step_target:
                return (
                    f"🎉 **Awesome job!** Today you have completed **{steps_today:,} steps**, smashing your goal of **{step_target:,} steps** by {abs(diff):,} steps! "
                    f"Keep this movement momentum going!"
                )
            else:
                pct = round((steps_today / step_target) * 100, 1)
                return (
                    f"Hey! Today you've completed **{steps_today:,} steps** so far ({pct}% of your {step_target:,} step goal). "
                    f"You have **{diff:,} steps remaining** to hit your target. A brisk 15-minute evening walk will get you right across the finish line! 🚶‍♂️"
                )

        # Question: Weekly step average
        elif "step" in q_lower or "walk" in q_lower or "activity" in q_lower:
            avg_s = int(curr_avgs.get("steps", 8000))
            diff = avg_s - step_target
            comp = f"exceeding your {step_target:,} target by {abs(diff):,} steps" if diff >= 0 else f"trailing your {step_target:,} target by {abs(diff):,} steps"
            max_s = max(recent_7, key=lambda r: r.steps)
            min_s = min(recent_7, key=lambda r: r.steps)
            return (
                f"Over the last 7 days, you averaged **{avg_s:,} steps per day** ({comp}).\n\n"
                f"• **Peak movement day:** {max_s.date} with **{max_s.steps:,} steps** 🔥\n"
                f"• **Lowest movement day:** {min_s.date} with **{min_s.steps:,} steps**\n\n"
                f"Today you're at **{today_rec.steps if today_rec else latest_rec.steps:,} steps**. Keep up the steady cadence!"
            )

        # Question: Sleep change & cycle
        elif "sleep" in q_lower or "rest" in q_lower or "bed" in q_lower or "cycle" in q_lower:
            avg_sl = curr_avgs.get("sleep_hours", 7.2)
            today_sleep = today_rec.sleep_hours if today_rec else (latest_rec.sleep_hours if latest_rec else 7.0)
            std_sl = analytics.get("sleep_std_hours", 0.5)
            chg = analytics.get("changes_pct", {}).get("sleep_hours", 0.0)
            trend_text = f"+{chg}% compared to the prior week" if chg >= 0 else f"{chg}% compared to the prior week"
            status_text = "healthy and restorative" if today_sleep >= 7.0 else "shortened (incomplete restorative cycles)"
            return (
                f"Last night you logged **{today_sleep} hours of sleep**, which is {status_text} (Target: {sleep_target}h).\n\n"
                f"• **7-Day Average:** {avg_sl}h per night ({trend_text})\n"
                f"• **Rhythm Stability:** ±{std_sl}h day-to-day variance\n\n"
                f"💡 **Coach Advice:** Aim to wind down by **{preferences.preferred_sleep_time if preferences else '23:00'}** tonight with dimmed lights to protect your deep REM recovery cycles."
            )

        # Question: Screen time
        elif "screen" in q_lower or "phone" in q_lower or "digital" in q_lower:
            today_sc = today_rec.screen_time if today_rec else (latest_rec.screen_time if latest_rec else 3.8)
            avg_sc = curr_avgs.get("screen_time", 4.0)
            diff = round(today_sc - screen_limit, 1)
            status_text = f"🚨 Exceeding your healthy limit by +{diff}h" if diff > 0 else f"✅ Comfortable ({round(screen_limit - today_sc, 1)}h buffer remaining)"
            return (
                f"📱 **Digital Usage Check:**\n\n"
                f"• **Today's Screen Time:** {today_sc}h (Target limit: {screen_limit}h) — {status_text}\n"
                f"• **7-Day Average:** {avg_sc} hours/day\n\n"
                f"Remember to rest your eyes using the 20-20-20 rule during prolonged device blocks!"
            )

        # Question: Least active days
        elif "least active" in q_lower or "worst" in q_lower or "lowest" in q_lower:
            min_s = min(recent_7, key=lambda r: r.steps)
            return (
                f"Your least active day recently was **{min_s.date}** with **{min_s.steps:,} steps** and {min_s.exercise_minutes} minutes of exercise. "
                f"Screen time was {min_s.screen_time}h and sleep duration was {min_s.sleep_hours}h."
            )

        # Question: Improvements / What to do next week
        elif "improve" in q_lower or "recommend" in q_lower or "next week" in q_lower:
            return (
                f"Based on your actual {len(records)} days of lifestyle data, here are 3 high-impact recommendations:\n\n"
                f"1. **Evening Digital Curfew:** Reduce screen time 30 minutes before bed to allow natural melatonin onset.\n"
                f"2. **Midday Movement Break:** Add two 10-minute walking sessions to comfortably reach your {step_target:,} daily steps.\n"
                f"3. **Morning Hydration:** Drink a large glass of water upon waking to match your {water_target}L target."
            )

        # Summary inquiry
        elif "summary" in q_lower or "week" in q_lower or "how am i" in q_lower:
            score = analytics.get("score", {}).get("overall_score", 85)
            level = analytics.get("score", {}).get("level", "Thriving")
            return (
                f"### 📋 Your 7-Day Lifestyle Summary:\n\n"
                f"• **Daily Movement:** {int(curr_avgs.get('steps', 0)):,} steps/day ({analytics.get('changes_pct', {}).get('steps', 0):+}%)\n"
                f"• **Sleep Rest:** {curr_avgs.get('sleep_hours', 0)}h/night (Target: {sleep_target}h)\n"
                f"• **Screen Time:** {curr_avgs.get('screen_time', 0)}h/day (Limit: {screen_limit}h)\n"
                f"• **Exercise:** {int(curr_avgs.get('exercise_minutes', 0))} min/day across {analytics.get('workout_days_7', 0)} active workout days\n"
                f"• **Personal Intelligence Score:** **{score}/100** ({level})"
            )

        # Default fallback
        else:
            return (
                f"Here is your current lifestyle snapshot based on your {len(records)} logged days:\n\n"
                f"• **Today's Steps:** {today_rec.steps if today_rec else latest_rec.steps:,} / {step_target:,} target\n"
                f"• **Last Night's Sleep:** {today_rec.sleep_hours if today_rec else latest_rec.sleep_hours}h / {sleep_target}h target\n"
                f"• **Current Screen Time:** {today_rec.screen_time if today_rec else latest_rec.screen_time}h / {screen_limit}h limit\n\n"
                f"Feel free to ask me questions like *'How many steps did I average this week?'*, *'How has my sleep changed?'*, or *'How many steps have I completed today?'*!"
            )

    context_summary = f"Grounded in {len(records)} days of verified personal data."

    if not settings.GEMINI_API_KEY:
        return {
            "answer": humanized_coach_answer(question),
            "context_summary": context_summary,
            "source": "analytics-fallback"
        }

    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        context_data = {
            "today_date": today_str,
            "today_entry": {
                "steps": today_rec.steps if today_rec else (latest_rec.steps if latest_rec else 0),
                "sleep_hours": today_rec.sleep_hours if today_rec else (latest_rec.sleep_hours if latest_rec else 0),
                "screen_time": today_rec.screen_time if today_rec else (latest_rec.screen_time if latest_rec else 0),
                "exercise_minutes": today_rec.exercise_minutes if today_rec else 0,
                "water_intake": today_rec.water_intake if today_rec else 0,
                "energy": today_rec.energy if today_rec else 7,
            },
            "recent_7_averages": analytics.get("recent_7_avgs"),
            "weekly_percentage_changes": analytics.get("changes_pct"),
            "user_targets": {
                "step_target": step_target,
                "sleep_target": sleep_target,
                "screen_limit": screen_limit,
                "water_target": water_target,
            },
            "personal_intelligence_score": analytics.get("score", {}).get("overall_score")
        }

        prompt = f"""You are the user's personal Android health companion. Answer the following question in a warm, encouraging, humanized tone.
Use the EXACT verified numbers from their metrics below.
If they ask about today's steps or sleep, cite today's numbers directly and celebrate or motivate them!

USER INQUIRY: "{question}"

VERIFIED USER LIFESTYLE METRICS:
{json.dumps(context_data, indent=2)}
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "temperature": 0.4
            }
        )
        return {
            "answer": response.text.strip(),
            "context_summary": context_summary,
            "source": "gemini"
        }
    except Exception as e:
        logger.warning(f"Gemini API chat error: {e}. Using humanized analytics response.")
        return {
            "answer": humanized_coach_answer(question),
            "context_summary": context_summary,
            "source": "analytics-fallback"
        }
