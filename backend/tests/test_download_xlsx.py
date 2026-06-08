"""Phase 6: GET /clean/download-xlsx/{cache_id} — typed XLSX export."""
import uuid
import io
import pandas as pd
from fastapi.testclient import TestClient
import backend.main as main

client = TestClient(main.app)


def _seed(df: pd.DataFrame) -> str:
    cid = str(uuid.uuid4())
    main._cleaned_cache[cid] = {"df": df, "stats": {}}
    return cid


def test_download_xlsx_returns_xlsx_content_type():
    cid = _seed(pd.DataFrame({"Name": ["Alice"], "Score": [10]}))
    resp = client.get(f"/clean/download-xlsx/{cid}")
    assert resp.status_code == 200
    assert "spreadsheetml" in resp.headers["content-type"]


def test_download_xlsx_unknown_cache_returns_404():
    resp = client.get(f"/clean/download-xlsx/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_download_xlsx_content_disposition_is_attachment():
    cid = _seed(pd.DataFrame({"x": [1]}))
    resp = client.get(f"/clean/download-xlsx/{cid}")
    assert "attachment" in resp.headers["content-disposition"]
    assert ".xlsx" in resp.headers["content-disposition"]


def test_download_xlsx_ic_column_preserved_as_text():
    """MyKid column with leading-zero values must survive the XLSX round-trip as text."""
    df = pd.DataFrame({"MyKid": ["010304050607", "020304050608"]})
    cid = _seed(df)
    resp = client.get(f"/clean/download-xlsx/{cid}")
    assert resp.status_code == 200

    wb = pd.read_excel(io.BytesIO(resp.content), dtype=str)
    assert wb["MyKid"].iloc[0] == "010304050607", "Leading zero must not be stripped"
    assert wb["MyKid"].iloc[1] == "020304050608"


def test_download_xlsx_numeric_columns_still_numeric():
    """Numeric columns (Berat_kg) must NOT be coerced to text."""
    df = pd.DataFrame({"Berat_kg": [25.0, 30.5], "Name": ["A", "B"]})
    cid = _seed(df)
    resp = client.get(f"/clean/download-xlsx/{cid}")
    wb = pd.read_excel(io.BytesIO(resp.content))
    assert pd.api.types.is_numeric_dtype(wb["Berat_kg"])
