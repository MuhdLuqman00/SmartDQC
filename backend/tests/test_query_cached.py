"""Phase 5: POST /clean/query-cached — stable-key seam with _row_id and full-dataset access."""
import uuid
import pandas as pd
from fastapi.testclient import TestClient
import backend.main as main

client = TestClient(main.app)


def _seed(df: pd.DataFrame) -> str:
    cid = str(uuid.uuid4())
    main._cleaned_cache[cid] = {"df": df, "stats": {}}
    return cid


def _base_df():
    return pd.DataFrame({
        "Name":     ["Alice", "Bob", "Carol"],
        "Berat_kg": [25.0,    55.0,  15.0],
    })


# ── Basic contract ────────────────────────────────────────────────────────────

def test_returns_rows_with_row_id():
    """Every row must carry a _row_id integer."""
    cid = _seed(_base_df())
    resp = client.post("/clean/query-cached", json={"cache_id": cid})
    assert resp.status_code == 200
    body = resp.json()
    assert "rows" in body and "total" in body and "returned" in body
    for row in body["rows"]:
        assert "_row_id" in row
        assert isinstance(row["_row_id"], int)


def test_row_id_is_zero_based_sequential():
    """_row_id values are 0, 1, 2 ... in original order."""
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid}).json()
    ids = [r["_row_id"] for r in body["rows"]]
    assert ids == [0, 1, 2]


def test_flagged_field_embedded_in_rows():
    """Each row carries a _flagged boolean."""
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid}).json()
    for row in body["rows"]:
        assert "_flagged" in row
        assert isinstance(row["_flagged"], bool)


def test_total_matches_full_dataset():
    """total reflects entire dataset, returned reflects the window."""
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "limit": 2}).json()
    assert body["total"] == 3
    assert body["returned"] == 2
    assert len(body["rows"]) == 2


def test_unknown_cache_id_returns_404():
    resp = client.post("/clean/query-cached", json={"cache_id": str(uuid.uuid4())})
    assert resp.status_code == 404


# ── Offset / limit ────────────────────────────────────────────────────────────

def test_offset_skips_rows():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "offset": 1, "limit": 2}).json()
    names = [r["Name"] for r in body["rows"]]
    assert names == ["Bob", "Carol"]


def test_offset_beyond_total_returns_empty():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "offset": 100}).json()
    assert body["returned"] == 0
    assert body["rows"] == []
    assert body["total"] == 3


# ── Search ────────────────────────────────────────────────────────────────────

def test_search_filters_rows():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "search": "alice"}).json()
    assert body["total"] == 1
    assert body["rows"][0]["Name"] == "Alice"


def test_search_is_case_insensitive():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "search": "CAROL"}).json()
    assert body["total"] == 1


def test_search_no_match_returns_empty():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "search": "zzznomatch"}).json()
    assert body["total"] == 0
    assert body["rows"] == []


# ── Sort ──────────────────────────────────────────────────────────────────────

def test_sort_asc_reorders_rows():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "sort_col": "Berat_kg", "sort_dir": "asc"}).json()
    weights = [r["Berat_kg"] for r in body["rows"]]
    assert weights == sorted(weights)


def test_sort_desc_reorders_rows():
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "sort_col": "Berat_kg", "sort_dir": "desc"}).json()
    weights = [r["Berat_kg"] for r in body["rows"]]
    assert weights == sorted(weights, reverse=True)


def test_row_id_stable_under_sort():
    """After sorting, _row_id still reflects original DataFrame position."""
    cid = _seed(_base_df())
    body = client.post("/clean/query-cached", json={"cache_id": cid, "sort_col": "Berat_kg", "sort_dir": "asc"}).json()
    # Sorted asc by weight: Carol(15)=idx2, Alice(25)=idx0, Bob(55)=idx1
    ids = [r["_row_id"] for r in body["rows"]]
    assert ids == [2, 0, 1]


# ── Edit safety ───────────────────────────────────────────────────────────────

def test_edit_via_row_id_after_sort():
    """PATCH /clean/cell with row_index=_row_id correctly updates the right row after sorting."""
    df = _base_df()
    cid = _seed(df)
    sorted_body = client.post(
        "/clean/query-cached",
        json={"cache_id": cid, "sort_col": "Berat_kg", "sort_dir": "desc"},
    ).json()
    first_row = sorted_body["rows"][0]
    assert first_row["Name"] == "Bob"
    row_id = first_row["_row_id"]  # should be 1

    patch = client.patch("/clean/cell", json={
        "cache_id": cid, "row_index": row_id, "column": "Berat_kg", "value": "40.0",
    })
    assert patch.status_code == 200
    assert main._cleaned_cache[cid]["df"].iloc[row_id]["Berat_kg"] in (40.0, "40.0")
