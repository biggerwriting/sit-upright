# backend/tests/test_quota_service.py
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from quota.service import (
    provision_free_trial, get_quota, deduct_quota,
    create_session, update_session, end_session,
)
from models import QuotaPackage


async def test_provision_free_trial(db):
    await provision_free_trial(db, user_id=1)
    from sqlalchemy import select
    result = await db.execute(select(QuotaPackage).where(QuotaPackage.user_id == 1))
    pkg = result.scalar_one_or_none()
    assert pkg is not None
    assert pkg.remaining_seconds == 300
    assert pkg.expires_at is None


async def test_get_quota_sums_valid_packages(db):
    await provision_free_trial(db, user_id=1)       # 300 秒
    # 追加一个未过期的套餐
    expires = datetime.now(timezone.utc) + timedelta(days=10)
    db.add(QuotaPackage(user_id=1, remaining_seconds=3600, expires_at=expires))
    await db.commit()
    quota = await get_quota(db, user_id=1)
    assert quota.remainingSeconds == 3900
    assert quota.nearExpiry is None


async def test_get_quota_excludes_expired(db):
    expired = datetime.now(timezone.utc) - timedelta(hours=1)
    db.add(QuotaPackage(user_id=1, remaining_seconds=1000, expires_at=expired))
    await db.commit()
    quota = await get_quota(db, user_id=1)
    assert quota.remainingSeconds == 0


async def test_get_quota_near_expiry_detected(db):
    soon = datetime.now(timezone.utc) + timedelta(days=2)
    db.add(QuotaPackage(user_id=1, remaining_seconds=600, expires_at=soon))
    await db.commit()
    quota = await get_quota(db, user_id=1)
    assert quota.nearExpiry is not None
    assert quota.nearExpiry.seconds == 600


async def test_get_quota_free_trial_no_near_expiry(db):
    # expires_at=None 不触发预警
    await provision_free_trial(db, user_id=1)
    quota = await get_quota(db, user_id=1)
    assert quota.nearExpiry is None


async def test_deduct_quota_success(db):
    await provision_free_trial(db, user_id=1)
    ok = await deduct_quota(db, user_id=1, delta=100)
    assert ok is True
    quota = await get_quota(db, user_id=1)
    assert quota.remainingSeconds == 200


async def test_deduct_quota_insufficient(db):
    await provision_free_trial(db, user_id=1)  # 300 秒
    ok = await deduct_quota(db, user_id=1, delta=500)
    assert ok is False
    # 配额不足时不扣减
    quota = await get_quota(db, user_id=1)
    assert quota.remainingSeconds == 300


async def test_deduct_quota_earliest_expiry_first(db):
    later = datetime.now(timezone.utc) + timedelta(days=5)
    sooner = datetime.now(timezone.utc) + timedelta(days=1)
    db.add(QuotaPackage(user_id=1, remaining_seconds=200, expires_at=sooner))
    db.add(QuotaPackage(user_id=1, remaining_seconds=100, expires_at=later))
    await db.commit()
    # delta=250：先扣光 sooner(200→0)，再扣 50 from later(100→50)
    ok = await deduct_quota(db, user_id=1, delta=250)
    assert ok is True
    from sqlalchemy import select
    result = await db.execute(
        select(QuotaPackage)
        .where(QuotaPackage.user_id == 1)
        .order_by(QuotaPackage.expires_at.asc())
    )
    pkgs = result.scalars().all()
    assert pkgs[0].remaining_seconds == 0   # sooner 包耗尽
    assert pkgs[1].remaining_seconds == 50  # later 包剩 50


async def test_create_session_success(db):
    await provision_free_trial(db, user_id=1)
    sess = await create_session(db, user_id=1)
    assert sess.id is not None
    assert sess.good_seconds == 0
    assert sess.ended_at is None


async def test_create_session_no_quota(db):
    # 无配额时返回 402
    with pytest.raises(HTTPException) as exc:
        await create_session(db, user_id=1)
    assert exc.value.status_code == 402


async def test_update_session_deducts_quota(db):
    await provision_free_trial(db, user_id=1)
    sess = await create_session(db, user_id=1)
    await update_session(db, sess.id, user_id=1, good_seconds=20, bad_seconds=10)
    quota = await get_quota(db, user_id=1)
    assert quota.remainingSeconds == 270   # 300 - 30


async def test_update_session_quota_exhausted(db):
    db.add(QuotaPackage(user_id=1, remaining_seconds=10, expires_at=None))
    await db.commit()
    sess = await create_session(db, user_id=1)
    # 本次上报 delta=50，超过可用 10 秒
    with pytest.raises(HTTPException) as exc:
        await update_session(db, sess.id, user_id=1, good_seconds=30, bad_seconds=20)
    assert exc.value.status_code == 402


async def test_update_session_already_ended(db):
    await provision_free_trial(db, user_id=1)
    sess = await create_session(db, user_id=1)
    await end_session(db, sess.id, user_id=1)
    with pytest.raises(HTTPException) as exc:
        await update_session(db, sess.id, user_id=1, good_seconds=10, bad_seconds=5)
    assert exc.value.status_code == 400


async def test_end_session_success(db):
    await provision_free_trial(db, user_id=1)
    sess = await create_session(db, user_id=1)
    await update_session(db, sess.id, user_id=1, good_seconds=40, bad_seconds=10)
    result = await end_session(db, sess.id, user_id=1)
    assert result.ended_at is not None
    assert result.good_seconds == 40
    assert result.bad_seconds == 10


async def test_end_session_already_ended(db):
    await provision_free_trial(db, user_id=1)
    sess = await create_session(db, user_id=1)
    await end_session(db, sess.id, user_id=1)
    with pytest.raises(HTTPException) as exc:
        await end_session(db, sess.id, user_id=1)
    assert exc.value.status_code == 400
