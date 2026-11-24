from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from app.models.user import User
from app.models.record import DailyRecord
from app.models.insight import Insight
from app.schemas.insight import InsightResponse, InsightGenerateResponse
from app.services.ai_engine import generate_insights_with_ai, generate_fallback_insights
from app.services.analytics import calculate_analytics
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/insights", tags=["AI Insights"])

@router.get("", response_model=List[InsightResponse])
def get_insights(
    limit: int = 25,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    insights = db.query(Insight).filter(
        Insight.user_id == current_user.id
    ).order_by(Insight.created_at.desc()).limit(limit).all()

    # Ensure all 5 core categories are populated for the user
    existing_cats = {i.category.lower() for i in insights}
    required_cats = {"activity", "sleep", "screen_time", "routine", "wellness"}
    missing = required_cats - existing_cats

    if not insights or missing:
        records = db.query(DailyRecord).filter(
            DailyRecord.user_id == current_user.id
        ).order_by(DailyRecord.date.asc()).all()
        pref = current_user.preferences

        # If user has no records, seed baseline first
        if not records:
            from app.routes.auth import seed_user_initial_records
            seed_user_initial_records(current_user.id, db)
            records = db.query(DailyRecord).filter(
                DailyRecord.user_id == current_user.id
            ).order_by(DailyRecord.date.asc()).all()

        analytics = calculate_analytics(records, pref)
        items = generate_fallback_insights(analytics, pref)
        for s in items:
            if s.category in missing or not insights:
                obj = Insight(
                    user_id=current_user.id,
                    title=s.title,
                    observation=s.observation,
                    evidence=s.evidence,
                    explanation=s.explanation,
                    recommendation=s.recommendation,
                    category=s.category,
                    confidence=s.confidence
                )
                db.add(obj)
        db.commit()
        insights = db.query(Insight).filter(
            Insight.user_id == current_user.id
        ).order_by(Insight.created_at.desc()).limit(limit).all()

    return insights

@router.post("/generate", response_model=InsightGenerateResponse)
def generate_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.asc()).all()

    pref = current_user.preferences

    # If user has no records, seed initial baseline so insights have numbers to analyze
    if not records:
        from app.routes.auth import seed_user_initial_records
        seed_user_initial_records(current_user.id, db)
        records = db.query(DailyRecord).filter(
            DailyRecord.user_id == current_user.id
        ).order_by(DailyRecord.date.asc()).all()

    if pref and not pref.ai_consent:
        analytics = calculate_analytics(records, pref)
        structured_list = generate_fallback_insights(analytics, pref)
        source = "local-privacy-rule-engine"
    else:
        structured_list = generate_insights_with_ai(records, pref)
        source = "gemini-ai"

    # Remove old placeholder insights that said "Begin Your Self-Discovery Journey"
    db.query(Insight).filter(
        Insight.user_id == current_user.id,
        Insight.title.like("%Begin Your Self-Discovery%")
    ).delete(synchronize_session=False)

    saved_insights = []
    for s in structured_list:
        obj = Insight(
            user_id=current_user.id,
            title=s.title,
            observation=s.observation,
            evidence=s.evidence,
            explanation=s.explanation,
            recommendation=s.recommendation,
            category=s.category,
            confidence=s.confidence
        )
        db.add(obj)
        saved_insights.append(obj)

    db.commit()
    for s in saved_insights:
        db.refresh(s)

    return InsightGenerateResponse(
        generated_count=len(saved_insights),
        source=source,
        insights=saved_insights
    )
