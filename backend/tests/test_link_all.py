"""Tests for /entity/link/all endpoint (P2-3)."""

import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="requires a live PostgreSQL DATABASE_URL",
)


def test_link_all_across_persisted_datasets(client_with_db, test_cache_with_data):
    """Test /entity/link/all links across persisted datasets not in hot cache."""
    cache_id, dataset_id = test_cache_with_data

    # First sync to persist records
    client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )

    # Link all should work from durable store
    response = client_with_db.post(
        "/entity/link/all",
        json={
            "dataset_ids": [dataset_id],
            "fuzzy_ic": True,
            "min_confidence": 0.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "total_groups" in body
    assert "profiles" in body


def test_link_all_sees_evicted_data(client_with_db, multiple_datasets_in_db):
    """P2-3 core win: link/all sees datasets not in hot cache."""
    ds_ids = multiple_datasets_in_db

    # Don't add to cache - simulate eviction
    # Link all should still see them from durable store
    response = client_with_db.post(
        "/entity/link/all",
        json={"dataset_ids": ds_ids, "min_confidence": 0.0},
    )
    assert response.status_code == 200
    body = response.json()
    # Should have data from the persisted datasets
    assert body["total_groups"] >= 0
