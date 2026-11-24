from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
from app.models.user import User
from app.models.record import DailyRecord
from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/goals", tags=["Goals"])

@router.get("", response_model=List[GoalResponse])
def get_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()
    
    # If user has no goals, initialize default core goals matching their preferences
    if not goals:
        pref = current_user.preferences
        default_goals = [
            Goal(user_id=current_user.id, metric="steps", title="Daily Step Target", target_value=float(pref.step_target if pref else 8000), timeframe="daily"),
            Goal(user_id=current_user.id, metric="sleep", title="Nightly Sleep Target", target_value=float(pref.sleep_target if pref else 8.0), timeframe="daily"),
            Goal(user_id=current_user.id, metric="exercise", title="Daily Workout Minutes", target_value=float(pref.exercise_target if pref else 30), timeframe="daily"),
            Goal(user_id=current_user.id, metric="water", title="Daily Hydration Goal", target_value=float(pref.water_target if pref else 2.5), timeframe="daily"),
        ]
        db.add_all(default_goals)
        db.commit()
        goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()

    # Calculate current progress from latest daily record
    latest_rec = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.desc()).first()

    response_list = []
    for g in goals:
        c_val = 0.0
        if latest_rec:
            if g.metric == "steps":
                c_val = float(latest_rec.steps)
            elif g.metric == "sleep":
                c_val = float(latest_rec.sleep_hours)
            elif g.metric == "exercise":
                c_val = float(latest_rec.exercise_minutes)
            elif g.metric == "water":
                c_val = float(latest_rec.water_intake)
            elif g.metric == "screen_time":
                c_val = float(latest_rec.screen_time)

        pct = round(min((c_val / g.target_value * 100), 200), 1) if g.target_value > 0 else 0.0

        response_list.append(GoalResponse(
            id=g.id,
            user_id=g.user_id,
            metric=g.metric,
            title=g.title,
            target_value=g.target_value,
            timeframe=g.timeframe,
            status=g.status,
            current_value=c_val,
            progress_pct=pct,
            created_at=g.created_at,
            updated_at=g.updated_at
        ))

    return response_list

@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal_in: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = Goal(
        user_id=current_user.id,
        metric=goal_in.metric,
        title=goal_in.title,
        target_value=goal_in.target_value,
        timeframe=goal_in.timeframe or "daily",
        status=goal_in.status or "active"
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        metric=goal.metric,
        title=goal.title,
        target_value=goal.target_value,
        timeframe=goal.timeframe,
        status=goal.status,
        current_value=0.0,
        progress_pct=0.0,
        created_at=goal.created_at,
        updated_at=goal.updated_at
    )

@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    goal_in: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")

    update_data = goal_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(goal, field, val)

    db.commit()
    db.refresh(goal)
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        metric=goal.metric,
        title=goal.title,
        target_value=goal.target_value,
        timeframe=goal.timeframe,
        status=goal.status,
        current_value=0.0,
        progress_pct=0.0,
        created_at=goal.created_at,
        updated_at=goal.updated_at
    )

@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")

    db.delete(goal)
    db.commit()
    return {"message": "Goal removed successfully", "id": goal_id}
