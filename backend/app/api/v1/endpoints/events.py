import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Event, User, Role
from app.core.security import get_current_user

router = APIRouter()

EVENT_COLORS = {
    "holiday": "#ef4444",
    "exam": "#f59e0b",
    "assignment": "#6366f1",
    "event": "#10b981",
    "announcement": "#06b6d4",
    "deadline": "#8b5cf6",
}


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "event"
    date: str
    end_date: Optional[str] = None
    color: Optional[str] = None
    all_day: bool = True


def serialize_event(e: Event):
    return {
        "id": str(e.id),
        "title": e.title,
        "description": e.description,
        "event_type": e.event_type,
        "date": e.date,
        "end_date": e.end_date,
        "color": e.color,
        "all_day": e.all_day,
        "created_at": e.created_at.isoformat(),
    }


@router.get("/")
def list_events(month: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Event)
    if month:  # format: YYYY-MM
        query = query.filter(Event.date.startswith(month))
    events = query.order_by(Event.date).all()
    return [serialize_event(e) for e in events]


@router.post("/")
def create_event(req: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Teachers and admins only")
    color = req.color or EVENT_COLORS.get(req.event_type, "#6366f1")
    event = Event(
        title=req.title,
        description=req.description,
        event_type=req.event_type,
        date=req.date,
        end_date=req.end_date,
        color=color,
        all_day=req.all_day,
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.delete("/{event_id}")
def delete_event(event_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Not authorized")
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Deleted"}
