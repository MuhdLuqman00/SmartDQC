"""Pytest fixtures for backend tests - SQLite in-memory for P2 tests."""

import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.types import JSON


@pytest.fixture(scope="function")
def sqlite_engine():
    """Create an in-memory SQLite engine with JSONB→JSON patch."""
    # Patch JSONB to use JSON before importing models
    import sqlalchemy.dialects.postgresql as pg

    original_jsonb = pg.JSONB

    # Replace JSONB with JSON for test duration
    pg.JSONB = JSON

    engine = create_engine("sqlite:///:memory:")

    # Create all tables
    from backend.db.models import Base

    Base.metadata.create_all(engine)

    # Restore original JSONB
    pg.JSONB = original_jsonb

    return engine


@pytest.fixture(scope="function")
def session_local(sqlite_engine):
    """Override SessionLocal to use test SQLite engine."""
    from sqlalchemy.orm import sessionmaker

    TestSessionLocal = sessionmaker(
        bind=sqlite_engine, autocommit=False, autoflush=False
    )

    with patch("backend.db.init_db.SessionLocal", TestSessionLocal):
        yield TestSessionLocal


@pytest.fixture(scope="function")
def db_session(session_local):
    """Provide a test database session."""
    session = session_local()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_dataset(db_session):
    """Create a test dataset."""
    from backend.db.models import Dataset

    ds = Dataset(
        id="test-ds-1",
        name="Test Dataset",
        filename="test.csv",
        source_type="myvass",
        row_count=10,
        created_at=datetime.utcnow(),
    )
    db_session.add(ds)
    db_session.commit()
    return ds


@pytest.fixture
def test_cache_with_data(monkeypatch, db_session, tmp_path):
    """Create a cached dataset with data and persist to DB."""
    from backend import main
    import pickle

    # Create test DataFrame
    df = pd.DataFrame(
        {
            "IC_NO_PASSPORT": ["900101010001", "900101010002", "910202020005"],
            "NAMA": ["ALI", "AHMAD", "SITI"],
            "TARIKH_LAHIR": ["2020-01-15", "2020-02-20", "2021-03-10"],
            "JANTINA": ["M", "M", "F"],
            "NEGERI": ["Selangor", "Johor", "KL"],
            "DAERAH": ["Petaling", "JB", "KL"],
            "BERAT_KG": [12.5, 14.0, 11.0],
            "TINGGI_CM": [85.0, 90.0, 80.0],
        }
    )

    cache_id = "test-cache-1"

    # Mock the cache
    monkeypatch.setattr(main, "_CACHE_DIR", tmp_path)
    main._cleaned_cache[cache_id] = {
        "df": df,
        "stats": {
            "filename": "test.csv",
            "source_type": "myvass",
        },
    }

    # Create dataset in DB
    from backend.db.models import Dataset

    ds = Dataset(
        id=cache_id,
        name="Test",
        filename="test.csv",
        source_type="myvass",
        row_count=3,
        created_at=datetime.utcnow(),
    )
    db_session.add(ds)
    db_session.commit()

    return cache_id, cache_id


@pytest.fixture
def multiple_datasets_in_db(db_session):
    """Create multiple datasets in DB for link-all testing."""
    from backend.db.models import Dataset, ChildRecord

    ds_ids = []
    for i in range(3):
        ds_id = f"test-ds-{i}"
        ds_ids.append(ds_id)

        ds = Dataset(
            id=ds_id,
            name=f"Test {i}",
            filename=f"test{i}.csv",
            source_type="myvass",
            row_count=2,
            created_at=datetime.utcnow(),
        )
        db_session.add(ds)

        # Add child records
        for j in range(2):
            rec = ChildRecord(
                dataset_id=ds_id,
                source_type="myvass",
                ic_norm=f"90010101000{i}{j}",
                name=f"Child {i}-{j}",
                dob=f"2020-0{i + 1}-15",
                gender="M" if j == 0 else "F",
            )
            db_session.add(rec)

    db_session.commit()
    return ds_ids


@pytest.fixture
def client_with_db(session_local, monkeypatch, tmp_path):
    """Create a test client with DB support."""
    from fastapi.testclient import TestClient
    from backend import main

    monkeypatch.setattr(main, "_CACHE_DIR", tmp_path)

    with TestClient(main.app) as client:
        yield client
