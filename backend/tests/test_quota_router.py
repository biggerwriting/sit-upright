# backend/tests/test_quota_router.py
import pytest
from unittest.mock import AsyncMock, patch


async def test_get_quota_returns_free_trial(client):
    # 注册（自动发放免费试用）
    await client.post("/auth/signup", json={"email": "q@test.com", "password": "password123"})
    r = await client.get("/quota")
    assert r.status_code == 200
    data = r.json()
    assert data["remainingSeconds"] == 300
    assert data["nearExpiry"] is None


async def test_get_quota_unauthenticated(client):
    r = await client.get("/quota")
    assert r.status_code == 401


async def test_create_session_success(client):
    await client.post("/auth/signup", json={"email": "s@test.com", "password": "password123"})
    r = await client.post("/sessions")
    assert r.status_code == 200
    assert "sessionId" in r.json()


async def test_create_session_no_quota(client):
    # 注册后手动耗尽配额
    await client.post("/auth/signup", json={"email": "nq@test.com", "password": "password123"})
    sess_r = await client.post("/sessions")
    session_id = sess_r.json()["sessionId"]
    # 上报消耗全部 300 秒配额
    await client.patch(f"/sessions/{session_id}",
                       json={"goodSeconds": 200, "badSeconds": 100})
    await client.patch(f"/sessions/{session_id}/end")
    # 再开会话应返回 402
    r = await client.post("/sessions")
    assert r.status_code == 402


async def test_update_session_success(client):
    await client.post("/auth/signup", json={"email": "u@test.com", "password": "password123"})
    sess_r = await client.post("/sessions")
    session_id = sess_r.json()["sessionId"]
    r = await client.patch(f"/sessions/{session_id}",
                           json={"goodSeconds": 20, "badSeconds": 10})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # 配额应扣减 30 秒
    quota_r = await client.get("/quota")
    assert quota_r.json()["remainingSeconds"] == 270


async def test_update_session_not_found(client):
    await client.post("/auth/signup", json={"email": "uf@test.com", "password": "password123"})
    r = await client.patch("/sessions/nonexistent-id",
                           json={"goodSeconds": 10, "badSeconds": 5})
    assert r.status_code == 404


async def test_end_session_returns_stats(client):
    await client.post("/auth/signup", json={"email": "e@test.com", "password": "password123"})
    sess_r = await client.post("/sessions")
    session_id = sess_r.json()["sessionId"]
    await client.patch(f"/sessions/{session_id}",
                       json={"goodSeconds": 40, "badSeconds": 10})
    r = await client.patch(f"/sessions/{session_id}/end")
    assert r.status_code == 200
    data = r.json()
    assert data["totalSeconds"] == 50
    assert data["goodSeconds"] == 40
    assert data["badSeconds"] == 10
    assert len(data["segments"]) == 2


async def test_end_session_already_ended(client):
    await client.post("/auth/signup", json={"email": "ee@test.com", "password": "password123"})
    sess_r = await client.post("/sessions")
    session_id = sess_r.json()["sessionId"]
    await client.patch(f"/sessions/{session_id}/end")
    r = await client.patch(f"/sessions/{session_id}/end")
    assert r.status_code == 400
