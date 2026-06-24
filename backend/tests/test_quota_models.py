import pytest
from datetime import datetime, timezone, timedelta
from models import QuotaPackage, Session
import uuid


async def test_create_quota_package(db):
    pkg = QuotaPackage(user_id=1, remaining_seconds=300, expires_at=None)
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    assert pkg.id is not None
    assert pkg.remaining_seconds == 300
    assert pkg.expires_at is None
    assert pkg.created_at is not None


async def test_create_session(db):
    now = datetime.now(timezone.utc)
    sess = Session(
        id=str(uuid.uuid4()),
        user_id=1,
        good_seconds=0,
        bad_seconds=0,
        started_at=now,
    )
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    assert sess.id is not None
    assert sess.ended_at is None
