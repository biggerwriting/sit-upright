import pytest
from datetime import datetime, timezone, timedelta
import uuid
from models import Session


async def _insert_session(db, user_id: int, good: int, bad: int, minutes_ago: int):
    started = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    ended = started + timedelta(seconds=good + bad)
    sess = Session(
        id=str(uuid.uuid4()),
        user_id=user_id,
        good_seconds=good,
        bad_seconds=bad,
        started_at=started,
        ended_at=ended,
    )
    db.add(sess)
    await db.commit()
    return sess


async def test_get_sessions_unauthenticated(client):
    r = await client.get("/sessions")
    assert r.status_code == 401


async def test_get_sessions_empty(client):
    await client.post("/auth/signup", json={"email": "h@test.com", "password": "password123"})
    r = await client.get("/sessions")
    assert r.status_code == 200
    data = r.json()
    assert data["sessions"] == []
    assert data["hasMore"] is False


async def test_get_sessions_returns_list(client, db):
    await client.post("/auth/signup", json={"email": "h2@test.com", "password": "password123"})
    # get user_id from /auth/me
    me = await client.get("/auth/me")
    uid = me.json()["id"]
    await _insert_session(db, uid, good=40, bad=10, minutes_ago=5)
    r = await client.get("/sessions")
    assert r.status_code == 200
    data = r.json()
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["goodSeconds"] == 40
    assert data["sessions"][0]["totalSeconds"] == 50
    assert data["hasMore"] is False


async def test_get_sessions_limit_enforced(client, db):
    await client.post("/auth/signup", json={"email": "h3@test.com", "password": "password123"})
    me = await client.get("/auth/me")
    uid = me.json()["id"]
    for i in range(5):
        await _insert_session(db, uid, good=10, bad=5, minutes_ago=i * 10)
    r = await client.get("/sessions?limit=3")
    assert r.status_code == 200
    assert len(r.json()["sessions"]) == 3
    assert r.json()["hasMore"] is True


async def test_get_sessions_limit_exceeds_max(client):
    await client.post("/auth/signup", json={"email": "h4@test.com", "password": "password123"})
    r = await client.get("/sessions?limit=51")
    assert r.status_code == 422


async def test_get_sessions_cursor_pagination(client, db):
    await client.post("/auth/signup", json={"email": "h5@test.com", "password": "password123"})
    me = await client.get("/auth/me")
    uid = me.json()["id"]
    for i in range(7):
        await _insert_session(db, uid, good=10, bad=5, minutes_ago=i * 10)

    page1 = await client.get("/sessions?limit=4")
    assert page1.status_code == 200
    assert len(page1.json()["sessions"]) == 4
    assert page1.json()["hasMore"] is True

    last_started_at = page1.json()["sessions"][-1]["startedAt"]
    page2 = await client.get(f"/sessions?limit=4&before={last_started_at}")
    assert page2.status_code == 200
    assert len(page2.json()["sessions"]) == 3
    assert page2.json()["hasMore"] is False
