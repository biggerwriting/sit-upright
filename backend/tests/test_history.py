import pytest
from datetime import datetime, timezone, timedelta
from quota.service import list_sessions, provision_free_trial, create_session, update_session, end_session
import uuid


async def _make_ended_session(db, user_id: int, good: int, bad: int, offset_minutes: int = 0):
    """Helper: 创建并结束一个会话，started_at 往前偏移 offset_minutes 分钟。"""
    from models import Session
    started = datetime.now(timezone.utc) - timedelta(minutes=offset_minutes + good + bad)
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
    await db.refresh(sess)
    return sess


async def test_list_sessions_empty(db):
    result = await list_sessions(db, user_id=1)
    assert result.sessions == []
    assert result.hasMore is False


async def test_list_sessions_returns_ended_only(db):
    # 创建一个已结束和一个进行中的会话
    from models import Session
    ended = await _make_ended_session(db, user_id=1, good=40, bad=10)
    in_progress = Session(
        id=str(uuid.uuid4()),
        user_id=1,
        good_seconds=0,
        bad_seconds=0,
        started_at=datetime.now(timezone.utc),
        ended_at=None,  # 进行中
    )
    db.add(in_progress)
    await db.commit()

    result = await list_sessions(db, user_id=1)
    assert len(result.sessions) == 1
    assert result.sessions[0].id == ended.id


async def test_list_sessions_sorted_desc(db):
    s1 = await _make_ended_session(db, user_id=1, good=30, bad=10, offset_minutes=60)  # 更早
    s2 = await _make_ended_session(db, user_id=1, good=20, bad=5, offset_minutes=0)   # 更近

    result = await list_sessions(db, user_id=1)
    assert result.sessions[0].id == s2.id   # 最近的在前
    assert result.sessions[1].id == s1.id


async def test_list_sessions_has_more(db):
    for i in range(11):
        await _make_ended_session(db, user_id=1, good=10, bad=5, offset_minutes=i * 10)

    result = await list_sessions(db, user_id=1, limit=10)
    assert len(result.sessions) == 10
    assert result.hasMore is True


async def test_list_sessions_no_more(db):
    for i in range(5):
        await _make_ended_session(db, user_id=1, good=10, bad=5, offset_minutes=i * 10)

    result = await list_sessions(db, user_id=1, limit=10)
    assert len(result.sessions) == 5
    assert result.hasMore is False


async def test_list_sessions_cursor_pagination(db):
    # 创建 15 条会话
    sessions = []
    for i in range(15):
        s = await _make_ended_session(db, user_id=1, good=10, bad=5, offset_minutes=i * 5)
        sessions.append(s)

    # 第一批：最近 10 条
    page1 = await list_sessions(db, user_id=1, limit=10)
    assert len(page1.sessions) == 10
    assert page1.hasMore is True

    # 第二批：用游标继续
    last_started_at = page1.sessions[-1].startedAt
    page2 = await list_sessions(db, user_id=1, limit=10, before=last_started_at)
    assert len(page2.sessions) == 5
    assert page2.hasMore is False

    # 两批 id 不重复
    ids1 = {s.id for s in page1.sessions}
    ids2 = {s.id for s in page2.sessions}
    assert ids1.isdisjoint(ids2)


async def test_list_sessions_computed_fields(db):
    await _make_ended_session(db, user_id=1, good=45, bad=15)
    result = await list_sessions(db, user_id=1)
    item = result.sessions[0]
    assert item.goodSeconds == 45
    assert item.badSeconds == 15
    assert item.totalSeconds == 60
    assert item.endedAt is not None


async def test_list_sessions_user_isolation(db):
    # user 1 的会话
    await _make_ended_session(db, user_id=1, good=30, bad=10)
    # user 2 的会话
    await _make_ended_session(db, user_id=2, good=20, bad=5)

    result = await list_sessions(db, user_id=1)
    assert len(result.sessions) == 1
    assert result.sessions[0].goodSeconds == 30
