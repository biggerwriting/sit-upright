# backend/quota/service.py
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import QuotaPackage, Session
from schemas import QuotaResponse, NearExpiry

FREE_TRIAL_SECONDS = 300
NEAR_EXPIRY_DAYS = 3


async def provision_free_trial(db: AsyncSession, user_id: int) -> None:
    """注册时发放 5 分钟免费试用（永不过期）。"""
    result = await db.execute(
        select(QuotaPackage).where(
            QuotaPackage.user_id == user_id,
            QuotaPackage.expires_at.is_(None),
        )
    )
    if result.scalar_one_or_none():
        return  # already provisioned
    pkg = QuotaPackage(user_id=user_id, remaining_seconds=FREE_TRIAL_SECONDS, expires_at=None)
    db.add(pkg)
    await db.commit()


def _valid_packages_query(user_id: int, now: datetime):
    """构建查询：该用户所有未过期套餐（expires_at > now 或 NULL）。"""
    return (
        select(QuotaPackage)
        .where(
            QuotaPackage.user_id == user_id,
            or_(
                QuotaPackage.expires_at > now,
                QuotaPackage.expires_at.is_(None),
            ),
        )
        .order_by(QuotaPackage.expires_at.asc().nulls_last())
    )


async def get_quota(db: AsyncSession, user_id: int) -> QuotaResponse:
    now = datetime.now(timezone.utc)
    result = await db.execute(_valid_packages_query(user_id, now))
    packages = result.scalars().all()

    total = sum(p.remaining_seconds for p in packages)

    # 寻找最早到期且在 3 天内的套餐
    near_expiry: NearExpiry | None = None
    threshold = now + timedelta(days=NEAR_EXPIRY_DAYS)
    for pkg in packages:  # 已按 expires_at ASC NULLS LAST 排序
        if pkg.expires_at is not None and pkg.remaining_seconds > 0:
            expires = pkg.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires <= threshold:
                near_expiry = NearExpiry(seconds=pkg.remaining_seconds, expiresAt=expires)
                break

    return QuotaResponse(remainingSeconds=total, nearExpiry=near_expiry)


async def deduct_quota(db: AsyncSession, user_id: int, delta: int) -> bool:
    """按最早过期优先扣减 delta 秒。返回 True=成功，False=配额不足（不修改 DB）。"""
    if delta <= 0:
        return True
    now = datetime.now(timezone.utc)
    result = await db.execute(_valid_packages_query(user_id, now))
    packages = result.scalars().all()

    # 单次遍历：同时累计总量并记录扣减计划，不足则不修改任何对象
    plan: list[tuple] = []
    total = 0
    remaining = delta
    for pkg in packages:
        take = min(remaining, pkg.remaining_seconds)
        plan.append((pkg, take))
        total += pkg.remaining_seconds
        remaining -= take
        if remaining == 0:
            break

    if total < delta:
        return False

    for pkg, take in plan:
        pkg.remaining_seconds -= take

    return True


async def create_session(db: AsyncSession, user_id: int) -> Session:
    now = datetime.now(timezone.utc)
    total_result = await db.execute(
        select(func.coalesce(func.sum(QuotaPackage.remaining_seconds), 0)).where(
            QuotaPackage.user_id == user_id,
            or_(
                QuotaPackage.expires_at > now,
                QuotaPackage.expires_at.is_(None),
            ),
        )
    )
    if (total_result.scalar() or 0) <= 0:
        raise HTTPException(status_code=402, detail="配额不足，请购买套餐")
    sess = Session(
        id=str(uuid.uuid4()),
        user_id=user_id,
        good_seconds=0,
        bad_seconds=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    return sess


async def update_session(
    db: AsyncSession, session_id: str, user_id: int, good_seconds: int, bad_seconds: int
) -> None:
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    if sess.ended_at is not None:
        raise HTTPException(status_code=400, detail="会话已结束")

    old_total = sess.good_seconds + sess.bad_seconds
    new_total = good_seconds + bad_seconds
    delta = new_total - old_total

    if delta < 0:
        raise HTTPException(status_code=400, detail="坐姿秒数不可递减")

    if delta > 0:
        ok = await deduct_quota(db, user_id, delta)
        if not ok:
            raise HTTPException(status_code=402, detail="配额已耗尽，请购买套餐")

    sess.good_seconds = good_seconds
    sess.bad_seconds = bad_seconds
    await db.commit()


async def end_session(db: AsyncSession, session_id: str, user_id: int) -> Session:
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    if sess.ended_at is not None:
        raise HTTPException(status_code=400, detail="会话已结束")
    sess.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sess)
    return sess


from schemas import SessionListItem, SessionListResponse


async def list_sessions(
    db: AsyncSession,
    user_id: int,
    limit: int = 10,
    before: datetime | None = None,
) -> SessionListResponse:
    """返回游标分页的已结束会话列表，按 started_at DESC 排序。"""
    query = (
        select(Session)
        .where(
            Session.user_id == user_id,
            Session.ended_at.is_not(None),
        )
    )
    if before is not None:
        before_aware = before if before.tzinfo else before.replace(tzinfo=timezone.utc)
        query = query.where(Session.started_at < before_aware)

    query = query.order_by(Session.started_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    items = rows[:limit]

    def to_item(s: Session) -> SessionListItem:
        started = s.started_at if s.started_at.tzinfo else s.started_at.replace(tzinfo=timezone.utc)
        ended = s.ended_at if s.ended_at.tzinfo else s.ended_at.replace(tzinfo=timezone.utc)
        return SessionListItem(
            id=s.id,
            startedAt=started,
            endedAt=ended,
            totalSeconds=s.good_seconds + s.bad_seconds,
            goodSeconds=s.good_seconds,
            badSeconds=s.bad_seconds,
        )

    return SessionListResponse(
        sessions=[to_item(s) for s in items],
        hasMore=has_more,
    )
