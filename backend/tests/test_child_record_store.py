"""Tests for child_record table (P2-1)."""

import os
import uuid
from datetime import datetime

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="requires a live PostgreSQL DATABASE_URL",
)


def test_child_record_create_and_query():
    """Test creating a child record and querying by dataset_id and ic_norm."""
    from backend.db.init_db import init_db
    import backend.db.init_db as initdb
    from backend.db.models import ChildRecord, Dataset

    init_db()
    now = datetime.utcnow()
    ds_id = str(uuid.uuid4())

    with initdb.SessionLocal() as db:
        # Create parent dataset
        db.add(
            Dataset(
                id=ds_id,
                name="test",
                filename="test.csv",
                source_type="myvass",
                row_count=1,
                quality_score=50.0,
                created_at=now,
            )
        )
        # Create child record
        rec = ChildRecord(
            dataset_id=ds_id,
            source_type="myvass",
            ic_norm="900101010001",
            name="ALI BIN AHMAD",
            dob="2020-01-15",
            gender="M",
            state="Selangor",
            district="Petaling",
            measure_date="2020-03-01",
            weight_kg=12.5,
            height_cm=85.0,
            bmi=17.3,
            waz=0.5,
            haz=1.2,
            baz=0.8,
        )
        db.add(rec)
        db.commit()

        # Query by dataset_id
        results = db.query(ChildRecord).filter(ChildRecord.dataset_id == ds_id).all()
        assert len(results) == 1
        assert results[0].ic_norm == "900101010001"
        assert results[0].name == "ALI BIN AHMAD"


def test_child_record_query_by_ic_norm():
    """Test querying child records by ic_norm across datasets."""
    from backend.db.init_db import init_db
    import backend.db.init_db as initdb
    from backend.db.models import ChildRecord, Dataset

    init_db()
    now = datetime.utcnow()
    ds1_id = str(uuid.uuid4())
    ds2_id = str(uuid.uuid4())

    with initdb.SessionLocal() as db:
        # Create parent datasets
        db.add(
            Dataset(
                id=ds1_id,
                name="test1",
                filename="test1.csv",
                source_type="myvass",
                row_count=1,
                created_at=now,
            )
        )
        db.add(
            Dataset(
                id=ds2_id,
                name="test2",
                filename="test2.csv",
                source_type="ncdc",
                row_count=1,
                created_at=now,
            )
        )
        # Create child records with same IC
        db.add(
            ChildRecord(
                dataset_id=ds1_id,
                source_type="myvass",
                ic_norm="900101010001",
                name="ALI",
            )
        )
        db.add(
            ChildRecord(
                dataset_id=ds2_id,
                source_type="ncdc",
                ic_norm="900101010001",
                name="ALI BIN AHMAD",
            )
        )
        db.commit()

        # Query by ic_norm
        results = (
            db.query(ChildRecord).filter(ChildRecord.ic_norm == "900101010001").all()
        )
        assert len(results) == 2
        assert {r.dataset_id for r in results} == {ds1_id, ds2_id}


def test_child_record_cascade_delete():
    """Test that deleting a dataset cascades to child_record."""
    from backend.db.init_db import init_db
    import backend.db.init_db as initdb
    from backend.db.models import ChildRecord, Dataset

    init_db()
    now = datetime.utcnow()
    ds_id = str(uuid.uuid4())

    with initdb.SessionLocal() as db:
        # Create dataset and child record
        db.add(
            Dataset(
                id=ds_id,
                name="test",
                filename="test.csv",
                source_type="myvass",
                row_count=1,
                created_at=now,
            )
        )
        db.add(
            ChildRecord(
                dataset_id=ds_id,
                source_type="myvass",
                ic_norm="900101010001",
                name="ALI",
            )
        )
        db.commit()

        # Verify record exists
        count = db.query(ChildRecord).filter(ChildRecord.dataset_id == ds_id).count()
        assert count == 1

        # Delete dataset
        db.query(Dataset).filter(Dataset.id == ds_id).delete()
        db.commit()

        # Verify child record is gone (cascade)
        count = db.query(ChildRecord).filter(ChildRecord.dataset_id == ds_id).count()
        assert count == 0
