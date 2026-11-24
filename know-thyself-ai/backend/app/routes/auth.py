from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import random
from database import get_db
from app.models.user import User, UserPreference
from app.models.record import DailyRecord
from app.models.insight import Insight
from app.schemas.user import (
    UserRegister, UserLogin, Token, UserResponse,
    UserPreferenceUpdate, UserPreferenceResponse
)
from app.core.security import hash_password, verify_password, create_access_token
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def seed_user_initial_records(user_id: int, db: Session):
    """Seed 14 days of realistic baseline data so new users immediately have rich data for all features."""
    base_date = date.today()
    moods = ["Great", "Good", "Energetic", "Neutral", "Good"]
    
    # Check if records already exist
    existing_count = db.query(DailyRecord).filter(DailyRecord.user_id == user_id).count()
    if existing_count > 0:
        return

    for i in range(13, -1, -1):
        cur_date = (base_date - timedelta(days=i)).strftime("%Y-%m-%d")
        progress = (14 - i) / 14.0
        
        # Today's record (i == 0) has active partial counts
        if i == 0:
            steps = 5840
            sleep = 6.8
            screen = 3.6
            exercise = 25
            water = 2.0
            energy = 7
            mood = "Good"
            notes = "Active daily tracking session."
        else:
            steps = int(6200 + (progress * 2200) + random.randint(-600, 800))
            sleep = round(max(5.5, min(8.8, 6.2 + (progress * 1.3) + random.uniform(-0.4, 0.4))), 1)
            screen = round(max(2.0, min(7.5, 5.5 - (progress * 1.2) + random.uniform(-0.4, 0.4))), 1)
            exercise = max(10, min(75, int(15 + (progress * 25) + random.randint(-5, 10))))
            water = round(max(1.5, min(3.5, 1.8 + (progress * 0.8) + random.uniform(-0.2, 0.3))), 1)
            energy = max(4, min(9, int(5 + (progress * 3) + random.randint(-1, 1))))
            mood = moods[min(len(moods)-1, max(0, 4 - int(energy / 2.5)))]
            notes = f"Baseline lifestyle log for {cur_date}."

        rec = DailyRecord(
            user_id=user_id,
            date=cur_date,
            steps=steps,
            sleep_hours=sleep,
            screen_time=screen,
            exercise_minutes=exercise,
            water_intake=water,
            mood=mood,
            energy=energy,
            notes=notes,
            is_synthetic=True
        )
        db.add(rec)
    db.commit()

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    clean_email = user_in.email.lower().strip()
    clean_name = user_in.name.strip()

    # Check if user with same email exists
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists. Please sign in instead."
        )

    # Hash password securely
    hashed_pwd = hash_password(user_in.password)
    user = User(
        name=clean_name,
        email=clean_email,
        password_hash=hashed_pwd
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create or update default preferences
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(
            user_id=user.id,
            primary_goal="Optimize energy and sleep consistency",
            step_target=8000,
            sleep_target=8.0,
            exercise_target=30,
            water_target=2.5,
            screen_time_limit=4.0,
            preferred_sleep_time="23:00",
            ai_consent=True,
            onboarding_completed=True
        )
        db.add(pref)
    else:
        pref.primary_goal = "Optimize energy and sleep consistency"
        pref.step_target = 8000
        pref.sleep_target = 8.0
        pref.exercise_target = 30
        pref.water_target = 2.5
        pref.screen_time_limit = 4.0
        pref.ai_consent = True
        pref.onboarding_completed = True
    db.commit()

    # Automatically seed initial baseline data so the new user has instant live analytics
    seed_user_initial_records(user.id, db)

    db.refresh(user)

    # Generate token
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=token, token_type="bearer", user=user)

@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    clean_email = user_in.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials."
        )

    # Ensure user has baseline records if empty
    rec_count = db.query(DailyRecord).filter(DailyRecord.user_id == user.id).count()
    if rec_count == 0:
        seed_user_initial_records(user.id, db)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=token, token_type="bearer", user=user)

@router.post("/demo-login", response_model=Token)
def demo_login(db: Session = Depends(get_db)):
    demo_email = "demo@knowthyself.ai"
    user = db.query(User).filter(User.email == demo_email).first()

    if not user:
        user = User(
            name="Alex Morgan",
            email=demo_email,
            password_hash=hash_password("DemoPassword2026!")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        pref = UserPreference(
            user_id=user.id,
            primary_goal="Optimize energy and sleep consistency",
            step_target=8500,
            sleep_target=8.0,
            exercise_target=35,
            water_target=2.5,
            screen_time_limit=4.0,
            preferred_sleep_time="22:45",
            ai_consent=True,
            onboarding_completed=True
        )
        db.add(pref)
        db.commit()
        db.refresh(user)

    rec_count = db.query(DailyRecord).filter(DailyRecord.user_id == user.id).count()
    if rec_count == 0:
        seed_user_initial_records(user.id, db)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=token, token_type="bearer", user=user)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully", "user_id": current_user.id}

@router.put("/preferences", response_model=UserPreferenceResponse)
def update_preferences(
    pref_in: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    update_data = pref_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(pref, field, val)

    db.commit()
    db.refresh(pref)
    return pref

@router.post("/onboarding", response_model=UserPreferenceResponse)
def complete_onboarding(
    pref_in: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    update_data = pref_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(pref, field, val)
    pref.onboarding_completed = True

    db.commit()
    db.refresh(pref)
    return pref
