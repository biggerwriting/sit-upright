import pytest
from sqlalchemy import select
from models import User, PasswordResetToken
from datetime import datetime, timezone, timedelta


async def test_create_user(db):
    user = User(email="test@example.com", hashed_password="hashed")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.created_at is not None


async def test_create_reset_token(db):
    user = User(email="a@b.com", hashed_password="h")
    db.add(user)
    await db.commit()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    token = PasswordResetToken(user_id=user.id, token="abc123", expires_at=expires)
    db.add(token)
    await db.commit()
    await db.refresh(token)
    assert token.id is not None
    assert token.used is False
