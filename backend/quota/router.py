# backend/quota/router.py
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth.dependencies import get_current_user
from models import User
from quota.service import get_quota, create_session, update_session, end_session, list_sessions as _list_sessions
from schemas import (
    QuotaResponse, CreateSessionResponse,
    UpdateSessionRequest, UpdateSessionResponse, SessionStatsResponse,
    SessionStatsSegment, SessionListResponse,
)

router = APIRouter(tags=["quota"])


@router.get("/quota", response_model=QuotaResponse)
async def quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_quota(db, current_user.id)


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sess = await create_session(db, current_user.id)
    return CreateSessionResponse(sessionId=sess.id)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    limit: int = Query(default=10, ge=1, le=50),
    before: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _list_sessions(db, current_user.id, limit=limit, before=before)


@router.patch("/sessions/{session_id}", response_model=UpdateSessionResponse)
async def update_session_endpoint(
    session_id: str,
    body: UpdateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await update_session(db, session_id, current_user.id, body.goodSeconds, body.badSeconds)
    return UpdateSessionResponse()


@router.patch("/sessions/{session_id}/end", response_model=SessionStatsResponse)
async def end_session_endpoint(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sess = await end_session(db, session_id, current_user.id)
    total = sess.good_seconds + sess.bad_seconds
    segments: list[SessionStatsSegment] = []
    if sess.good_seconds > 0:
        segments.append(SessionStatsSegment(type="good", durationSeconds=sess.good_seconds))
    if sess.bad_seconds > 0:
        segments.append(SessionStatsSegment(type="bad", durationSeconds=sess.bad_seconds))
    return SessionStatsResponse(
        totalSeconds=total,
        goodSeconds=sess.good_seconds,
        badSeconds=sess.bad_seconds,
        segments=segments,
    )
