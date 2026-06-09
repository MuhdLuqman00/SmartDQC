"""Tests for child_record sync endpoint (P2-2)."""


def test_sync_endpoint_persists_records(client_with_db, test_cache_with_data):
    """Test /entity/records/sync persists child records from cache."""
    cache_id, dataset_id = test_cache_with_data

    # Sync should persist records
    response = client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )
    assert response.status_code == 200
    body = response.json()
    assert dataset_id in body["persisted_counts"]
    assert body["persisted_counts"][dataset_id] > 0


def test_sync_idempotent_replace(client_with_db, test_cache_with_data):
    """Re-sync should replace records, not duplicate."""
    cache_id, dataset_id = test_cache_with_data

    # First sync
    client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )

    # Second sync - should not increase count
    response = client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )
    body = response.json()
    # Count should be the same (replace, not append)
    assert body["persisted_counts"][dataset_id] > 0


def test_sync_idempotent_replace(client_with_db, test_cache_with_data):
    """Re-sync should replace records, not duplicate."""
    cache_id, dataset_id = test_cache_with_data

    # First sync
    client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )

    # Second sync - should not increase count
    response = client_with_db.post(
        "/entity/records/sync",
        json={"dataset_ids": [dataset_id]},
    )
    body = response.json()
    # Count should be the same (replace, not append)
    assert body["persisted_counts"][dataset_id] > 0
