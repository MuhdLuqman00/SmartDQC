import pytest
from fastapi.testclient import TestClient
from backend.main import app

_DEFAULT_RULE_KEYS = [
    "duplicate_check", "missing_value_check", "ic_format_check",
    "age_range_check", "height_range_check", "weight_range_check",
    "bmi_range_check", "date_format_check", "gender_value_check",
]


@pytest.fixture
def client(override_get_db):
    return TestClient(app)


def test_get_thresholds_returns_defaults(client):
    resp = client.get("/settings/thresholds")
    assert resp.status_code == 200
    data = resp.json()
    assert "missing_rate_warn" in data
    assert "missing_rate_fail" in data


def test_post_thresholds_persists(client):
    resp = client.post("/settings/thresholds", json={"missing_rate_warn": 0.07})
    assert resp.status_code == 200
    resp2 = client.get("/settings/thresholds")
    assert resp2.json()["missing_rate_warn"] == pytest.approx(0.07)


def test_get_rules_returns_all_defaults(client):
    resp = client.get("/settings/rules")
    assert resp.status_code == 200
    rules = resp.json()
    for key in _DEFAULT_RULE_KEYS:
        assert key in rules


def test_toggle_rule_disables(client):
    resp = client.post("/settings/rules/toggle", json={"rule": "duplicate_check", "enabled": False})
    assert resp.status_code == 200
    resp2 = client.get("/settings/rules")
    assert resp2.json()["duplicate_check"]["enabled"] is False


def test_toggle_unknown_rule_returns_404(client):
    resp = client.post("/settings/rules/toggle", json={"rule": "nonexistent_rule", "enabled": True})
    assert resp.status_code == 404
