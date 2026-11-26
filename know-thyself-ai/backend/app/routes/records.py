from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import csv
import io
import random
from database import get_db
from app.models.user import User
from app.models.record import DailyRecord
from app.schemas.record import (
    DailyRecordCreate, DailyRecordUpdate, DailyRecordResponse, CSVImportResult
)
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/records", tags=["Daily Records"])

@router.get("", response_model=List[DailyRecordResponse])
def get_records(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(DailyRecord).filter(DailyRecord.user_id == current_user.id)
    
    if start_date:
        query = query.filter(DailyRecord.date >= start_date)
    if end_date:
        query = query.filter(DailyRecord.date <= end_date)

    query = query.order_by(DailyRecord.date.desc())
    records = query.offset(offset).limit(limit).all()
    return records

@router.post("", response_model=DailyRecordResponse, status_code=status.HTTP_201_CREATED)
def create_record(
    record_in: DailyRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == record_in.date
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A record for date {record_in.date} already exists. Please edit the existing record instead."
        )

    record = DailyRecord(
        user_id=current_user.id,
        date=record_in.date,
        steps=record_in.steps,
        sleep_hours=record_in.sleep_hours,
        screen_time=record_in.screen_time,
        exercise_minutes=record_in.exercise_minutes,
        water_intake=record_in.water_intake,
        mood=record_in.mood,
        energy=record_in.energy,
        notes=record_in.notes,
        is_synthetic=False
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.post("/sync-steps", response_model=DailyRecordResponse)
def sync_live_steps(
    steps: Optional[int] = None,
    increment: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Real-time phone step counter synchronization endpoint."""
    today_str = date.today().strftime("%Y-%m-%d")
    record = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    if not record:
        new_val = steps if steps is not None else (increment if increment is not None else 0)
        record = DailyRecord(
            user_id=current_user.id,
            date=today_str,
            steps=max(0, new_val),
            sleep_hours=0.0,
            screen_time=0.0,
            exercise_minutes=0,
            water_intake=0.0,
            mood="Neutral",
            energy=7,
            notes="Live phone step synchronization",
            is_synthetic=False
        )
        db.add(record)
    else:
        if steps is not None:
            record.steps = max(0, steps)
        elif increment is not None:
            record.steps = max(0, record.steps + increment)
        else:
            record.steps += 100

    db.commit()
    db.refresh(record)
    return record

@router.post("/sync-phone", response_model=DailyRecordResponse)
def sync_phone_telemetry(
    steps: Optional[int] = None,
    screen_time: Optional[float] = None,
    active_seconds: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Real-time phone sensor & telemetry sync endpoint (live steps + screen time)."""
    today_str = date.today().strftime("%Y-%m-%d")
    record = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id,
        DailyRecord.date == today_str
    ).first()

    screen_hrs_inc = (active_seconds / 3600.0) if active_seconds else 0.0

    if not record:
        record = DailyRecord(
            user_id=current_user.id,
            date=today_str,
            steps=max(0, steps or 0),
            sleep_hours=0.0,
            screen_time=round(screen_time if screen_time is not None else screen_hrs_inc, 2),
            exercise_minutes=0,
            water_intake=0.0,
            mood="Neutral",
            energy=7,
            notes="Real-time Android phone sync",
            is_synthetic=False
        )
        db.add(record)
    else:
        if steps is not None:
            record.steps = max(0, steps)
        if screen_time is not None:
            record.screen_time = max(0.0, screen_time)
        elif screen_hrs_inc > 0:
            record.screen_time = round(record.screen_time + screen_hrs_inc, 2)

    db.commit()
    db.refresh(record)
    return record

@router.put("/{record_id}", response_model=DailyRecordResponse)
def update_record(
    record_id: int,
    record_in: DailyRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(DailyRecord).filter(
        DailyRecord.id == record_id,
        DailyRecord.user_id == current_user.id
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found or you do not have permission to modify it."
        )

    update_data = record_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(record, field, val)

    db.commit()
    db.refresh(record)
    return record

@router.delete("/{record_id}", status_code=status.HTTP_200_OK)
def delete_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(DailyRecord).filter(
        DailyRecord.id == record_id,
        DailyRecord.user_id == current_user.id
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found or you do not have permission to delete it."
        )

    db.delete(record)
    db.commit()
    return {"message": "Record deleted successfully", "id": record_id}

@router.post("/upload", response_model=CSVImportResult)
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only valid .csv files are supported."
        )

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to decode CSV file format.")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or headers are missing.")

    clean_fieldnames = [f.strip().lower() for f in reader.fieldnames]
    required_cols = {"date", "steps"}
    if not required_cols.issubset(set(clean_fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain at least 'date' and 'steps' columns. Found columns: {reader.fieldnames}"
        )

    total_rows = 0
    imported_rows = 0
    skipped_rows = 0
    errors: List[str] = []
    preview_sample: List[Dict[str, Any]] = []

    existing_dates = {
        r.date for r in db.query(DailyRecord.date).filter(DailyRecord.user_id == current_user.id).all()
    }

    for row_num, raw_row in enumerate(reader, start=2):
        total_rows += 1
        row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
        
        row_date = row.get("date")
        if not row_date:
            errors.append(f"Row {row_num}: Missing date value.")
            skipped_rows += 1
            continue

        try:
            parsed_date = datetime.strptime(row_date, "%Y-%m-%d").date()
        except ValueError:
            errors.append(f"Row {row_num}: Invalid date '{row_date}'. Must be YYYY-MM-DD.")
            skipped_rows += 1
            continue

        if row_date in existing_dates:
            errors.append(f"Row {row_num}: Record for date {row_date} already exists (skipped).")
            skipped_rows += 1
            continue

        try:
            steps = max(0, min(100000, int(float(row.get("steps", 0)))))
            sleep = max(0.0, min(24.0, float(row.get("sleep_hours", row.get("sleep", 7.0)))))
            screen = max(0.0, min(24.0, float(row.get("screen_time", row.get("screen", 4.0)))))
            exercise = max(0, min(1440, int(float(row.get("exercise_minutes", row.get("exercise", 20))))))
            water = max(0.0, min(15.0, float(row.get("water_intake", row.get("water", 2.0)))))
            energy = max(1, min(10, int(float(row.get("energy", 6)))))
            mood = row.get("mood", "Good") or "Good"
            notes = row.get("notes", "Imported via CSV")
        except (ValueError, TypeError) as num_err:
            errors.append(f"Row {row_num}: Numeric parsing error: {num_err}")
            skipped_rows += 1
            continue

        new_rec = DailyRecord(
            user_id=current_user.id,
            date=row_date,
            steps=steps,
            sleep_hours=sleep,
            screen_time=screen,
            exercise_minutes=exercise,
            water_intake=water,
            mood=mood[:50],
            energy=energy,
            notes=notes[:1000],
            is_synthetic=False
        )
        db.add(new_rec)
        existing_dates.add(row_date)
        imported_rows += 1

        if len(preview_sample) < 5:
            preview_sample.append({
                "date": row_date, "steps": steps, "sleep_hours": sleep,
                "screen_time": screen, "exercise_minutes": exercise, "mood": mood
            })

    db.commit()

    return CSVImportResult(
        success=imported_rows > 0,
        total_rows=total_rows,
        imported_rows=imported_rows,
        skipped_rows=skipped_rows,
        errors=errors[:15],
        sample_preview=preview_sample
    )

@router.post("/load-sample", response_model=List[DailyRecordResponse])
def load_sample_data(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    base_date = date.today()
    created_records = []
    moods = ["Great", "Good", "Energetic", "Neutral", "Tired", "Stressed"]

    existing_dates = {
        r.date for r in db.query(DailyRecord.date).filter(DailyRecord.user_id == current_user.id).all()
    }

    for i in range(days - 1, -1, -1):
        cur_date = (base_date - timedelta(days=i)).strftime("%Y-%m-%d")
        if cur_date in existing_dates:
            continue

        progress_factor = (days - i) / float(days)
        steps = int(5800 + (progress_factor * 2800) + random.randint(-900, 1100))
        sleep = round(6.0 + (progress_factor * 1.6) + random.uniform(-0.5, 0.6), 1)
        sleep = max(4.5, min(9.5, sleep))
        screen = round(5.9 - (progress_factor * 1.5) + random.uniform(-0.5, 0.6), 1)
        screen = max(1.5, min(9.0, screen))
        exercise = int(15 + (progress_factor * 25) + random.randint(-10, 15))
        exercise = max(0, min(90, exercise))
        water = round(1.7 + (progress_factor * 0.9) + random.uniform(-0.3, 0.4), 1)
        water = max(1.0, min(4.0, water))
        energy = min(10, max(3, int(5 + (progress_factor * 3) + random.randint(-1, 2))))
        mood = moods[min(len(moods)-1, max(0, 4 - int(energy / 2.5)))]

        rec = DailyRecord(
            user_id=current_user.id,
            date=cur_date,
            steps=steps,
            sleep_hours=sleep,
            screen_time=screen,
            exercise_minutes=exercise,
            water_intake=water,
            mood=mood,
            energy=energy,
            notes=f"Synthetic demo record for {cur_date}. Simulated healthy progression.",
            is_synthetic=True
        )
        db.add(rec)
        created_records.append(rec)

    db.commit()
    for r in created_records:
        db.refresh(r)

    return db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.desc()).limit(30).all()
