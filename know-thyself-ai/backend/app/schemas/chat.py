from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)

class ChatResponse(BaseModel):
    id: Optional[int] = None
    question: str
    answer: str
    context_summary: Optional[str] = None
    source: str = "gemini" # "gemini" or "fallback-analytics"
    created_at: Optional[datetime] = None

class ChatHistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
