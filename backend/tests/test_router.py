import pytest
from unittest.mock import AsyncMock, patch


async def test_signup_success(client):
    r = await client.post("/auth/signup", json={"email": "a@test.com", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@test.com"
    assert "token" in r.cookies


async def test_signup_duplicate_email(client):
    await client.post("/auth/signup", json={"email": "a@test.com", "password": "password123"})
    r = await client.post("/auth/signup", json={"email": "a@test.com", "password": "password456"})
    assert r.status_code == 400


async def test_signup_short_password(client):
    r = await client.post("/auth/signup", json={"email": "b@test.com", "password": "short"})
    assert r.status_code == 422


async def test_login_success(client):
    await client.post("/auth/signup", json={"email": "c@test.com", "password": "password123"})
    r = await client.post("/auth/login", json={"email": "c@test.com", "password": "password123"})
    assert r.status_code == 200
    assert "token" in r.cookies


async def test_login_wrong_password(client):
    await client.post("/auth/signup", json={"email": "d@test.com", "password": "password123"})
    r = await client.post("/auth/login", json={"email": "d@test.com", "password": "wrong"})
    assert r.status_code == 401


async def test_me_authenticated(client):
    await client.post("/auth/signup", json={"email": "e@test.com", "password": "password123"})
    r = await client.get("/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "e@test.com"


async def test_me_unauthenticated(client):
    r = await client.get("/auth/me")
    assert r.status_code == 401


async def test_logout(client):
    await client.post("/auth/signup", json={"email": "f@test.com", "password": "password123"})
    r = await client.post("/auth/logout")
    assert r.status_code == 200
    # token cookie 被清除
    assert client.cookies.get("token") is None


@patch("auth.service.send_reset_email", new_callable=AsyncMock)
async def test_forgot_password_silent(mock_send, client):
    # 邮箱不存在也返回 200，且不发邮件
    r = await client.post("/auth/forgot-password", json={"email": "nobody@test.com"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    mock_send.assert_not_called()


@patch("auth.service.send_reset_email", new_callable=AsyncMock)
async def test_forgot_password_sends_email_when_user_exists(mock_send, client):
    await client.post("/auth/signup", json={"email": "g@test.com", "password": "password123"})
    r = await client.post("/auth/forgot-password", json={"email": "g@test.com"})
    assert r.status_code == 200
    mock_send.assert_called_once()


async def test_reset_password_invalid_token(client):
    r = await client.post(
        "/auth/reset-password",
        json={"token": "invalid-token", "new_password": "newpassword123"},
    )
    assert r.status_code == 400
