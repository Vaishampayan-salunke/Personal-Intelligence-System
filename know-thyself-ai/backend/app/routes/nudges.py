from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from app.models.user import User
from app.models.record import DailyRecord
from app.models.nudge import Nudge
from app.schemas.nudge import NudgeResponse, NudgeUpdate
from app.services.nudge_engine import generate_smart_nudges_for_user
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/nudges", tags=["Smart Nudges"])

@router.get("", response_model=List[NudgeResponse])
def get_nudges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    nudges = db.query(Nudge).filter(
        Nudge.user_id == current_user.id,
        Nudge.status == "pending"
    ).order_by(Nudge.created_at.desc()).all()

    if len(nudges) < 2:
        records = db.query(DailyRecord).filter(
            DailyRecord.user_id == current_user.id
        ).order_by(DailyRecord.date.asc()).all()

        fresh = generate_smart_nudges_for_user(records, current_user.preferences, nudges)
        for fn in fresh:
            n_obj = Nudge(
                user_id=current_user.id,
                message=fn["message"],
                category=fn.get("category", "wellness"),
                status="pending",
                action_label=fn.get("action_label")
            )
            db.add(n_obj)
        db.commit()

        nudges = db.query(Nudge).filter(
            Nudge.user_id == current_user.id,
            Nudge.status == "pending"
        ).order_by(Nudge.created_at.desc()).all()

    return nudges

@router.patch("/{nudge_id}", response_model=NudgeResponse)
def update_nudge(
    nudge_id: int,
    nudge_in: NudgeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    nudge = db.query(Nudge).filter(
        Nudge.id == nudge_id,
        Nudge.user_id == current_user.id
    ).first()

    if not nudge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found or unauthorized."
        )

    nudge.status = nudge_in.status
    db.commit()
    db.refresh(nudge)
    return nudge
