from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from app.models.user import User
from app.models.record import DailyRecord
from app.models.chat import ChatHistory
from app.schemas.chat import ChatRequest, ChatResponse, ChatHistoryItem
from app.services.ai_engine import answer_user_chat_with_ai
from app.routes.dependencies import get_current_user

router = APIRouter(prefix="/api/ai", tags=["Ask Your Data AI"])

@router.post("/chat", response_model=ChatResponse)
def ask_your_data(
    chat_in: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch all records owned exclusively by current user
    records = db.query(DailyRecord).filter(
        DailyRecord.user_id == current_user.id
    ).order_by(DailyRecord.date.asc()).all()

    pref = current_user.preferences

    # Check AI consent preference
    ai_result = answer_user_chat_with_ai(chat_in.question, records, pref)

    # Save to user's chat history
    history_entry = ChatHistory(
        user_id=current_user.id,
        question=chat_in.question,
        answer=ai_result["answer"],
        context_summary=ai_result.get("context_summary")
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)

    return ChatResponse(
        id=history_entry.id,
        question=history_entry.question,
        answer=history_entry.answer,
        context_summary=history_entry.context_summary,
        source=ai_result.get("source", "gemini"),
        created_at=history_entry.created_at
    )

@router.get("/history", response_model=List[ChatHistoryItem])
def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    history = db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id
    ).order_by(ChatHistory.created_at.desc()).limit(limit).all()
    return list(reversed(history))

@router.delete("/history")
def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Chat history cleared successfully."}
