# backend/auth/dependencies.py
from fastapi import Cookie, Depends, HTTPException
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth.utils import decode_token
from auth.service import get_user_by_id
from models import User


async def get_current_user(
    token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        user_id = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    return await get_user_by_id(db, user_id)
