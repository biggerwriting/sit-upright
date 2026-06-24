# backend/auth/service.py
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, PasswordResetToken, QuotaPackage
from auth.utils import hash_password, verify_password, send_reset_email
from quota.service import FREE_TRIAL_SECONDS

RESET_TOKEN_EXPIRE_HOURS = 1


async def create_user(db: AsyncSession, email: str, password: str) -> User:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="密码至少 8 位")
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已注册")
    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    await db.flush()
    db.add(QuotaPackage(user_id=user.id, remaining_seconds=FREE_TRIAL_SECONDS, expires_at=None))
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


async def initiate_password_reset(db: AsyncSession, email: str) -> None:
    """Silently succeeds even if email not found (anti-enumeration)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return
    token_str = secrets.token_hex(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    reset_url = (
        f"{os.getenv('RESET_BASE_URL', 'http://localhost:3000')}"
        f"/reset-password?token={token_str}"
    )
    # Send email FIRST — if this fails, token is never persisted
    await send_reset_email(email, reset_url)
    token = PasswordResetToken(user_id=user.id, token=token_str, expires_at=expires)
    db.add(token)
    await db.commit()


async def complete_password_reset(
    db: AsyncSession, token_str: str, new_password: str
) -> None:
    if len(new_password) < 8:
        raise HTTPException(status_code=422, detail="密码至少 8 位")
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == token_str)
    )
    token = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    expires_aware = (
        token.expires_at.replace(tzinfo=timezone.utc)
        if token and token.expires_at.tzinfo is None
        else (token.expires_at if token else None)
    )
    if not token or token.used or (expires_aware and expires_aware < now):
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")
    result2 = await db.execute(select(User).where(User.id == token.user_id))
    user = result2.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="用户不存在")
    user.hashed_password = hash_password(new_password)
    token.used = True
    # Invalidate all other active tokens for this user
    result3 = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == token.user_id,
            PasswordResetToken.used == False,  # noqa: E712
        )
    )
    for other_token in result3.scalars().all():
        other_token.used = True
    await db.commit()
