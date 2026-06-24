# backend/tests/test_service.py
import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from auth.service import (
    create_user, authenticate_user, get_user_by_id,
    initiate_password_reset, complete_password_reset,
)
import secrets
from datetime import datetime, timezone, timedelta
from models import PasswordResetToken


async def test_create_user_success(db):
    user = await create_user(db, "alice@example.com", "password123")
    assert user.id is not None
    assert user.email == "alice@example.com"
    assert user.hashed_password != "password123"


async def test_create_user_duplicate_email(db):
    await create_user(db, "bob@example.com", "password123")
    with pytest.raises(HTTPException) as exc:
        await create_user(db, "bob@example.com", "password456")
    assert exc.value.status_code == 400


async def test_create_user_short_password(db):
    with pytest.raises(HTTPException) as exc:
        await create_user(db, "charlie@example.com", "short")
    assert exc.value.status_code == 422


async def test_authenticate_user_success(db):
    await create_user(db, "dave@example.com", "password123")
    user = await authenticate_user(db, "dave@example.com", "password123")
    assert user.email == "dave@example.com"


async def test_authenticate_user_wrong_password(db):
    await create_user(db, "eve@example.com", "password123")
    with pytest.raises(HTTPException) as exc:
        await authenticate_user(db, "eve@example.com", "wrongpass")
    assert exc.value.status_code == 401


async def test_authenticate_user_not_found(db):
    with pytest.raises(HTTPException) as exc:
        await authenticate_user(db, "nobody@example.com", "password123")
    assert exc.value.status_code == 401


async def test_get_user_by_id(db):
    user = await create_user(db, "frank@example.com", "password123")
    found = await get_user_by_id(db, user.id)
    assert found.id == user.id


async def test_get_user_by_id_not_found(db):
    with pytest.raises(HTTPException) as exc:
        await get_user_by_id(db, 9999)
    assert exc.value.status_code == 401


@patch("auth.service.send_reset_email", new_callable=AsyncMock)
async def test_initiate_reset_creates_token(mock_send, db):
    user = await create_user(db, "reset@example.com", "password123")
    await initiate_password_reset(db, "reset@example.com")
    mock_send.assert_called_once()
    call_args = mock_send.call_args
    assert "reset@example.com" == call_args[0][0]
    assert "/reset-password?token=" in call_args[0][1]


@patch("auth.service.send_reset_email", new_callable=AsyncMock)
async def test_initiate_reset_silent_for_unknown_email(mock_send, db):
    # 邮箱不存在时静默返回，不发邮件
    await initiate_password_reset(db, "nobody@example.com")
    mock_send.assert_not_called()


async def test_complete_reset_success(db):
    user = await create_user(db, "pw@example.com", "oldpassword")
    old_hash = user.hashed_password
    token_str = secrets.token_hex(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    token = PasswordResetToken(user_id=user.id, token=token_str, expires_at=expires)
    db.add(token)
    await db.commit()
    await complete_password_reset(db, token_str, "newpassword123")
    await db.refresh(user)
    assert user.hashed_password != old_hash
    await db.refresh(token)
    assert token.used is True


async def test_complete_reset_invalid_token(db):
    with pytest.raises(HTTPException) as exc:
        await complete_password_reset(db, "no-such-token", "newpassword123")
    assert exc.value.status_code == 400


async def test_complete_reset_expired_token(db):
    user = await create_user(db, "exp@example.com", "password123")
    token_str = secrets.token_hex(32)
    expired = datetime.now(timezone.utc) - timedelta(hours=1)
    token = PasswordResetToken(user_id=user.id, token=token_str, expires_at=expired)
    db.add(token)
    await db.commit()
    with pytest.raises(HTTPException) as exc:
        await complete_password_reset(db, token_str, "newpassword123")
    assert exc.value.status_code == 400
