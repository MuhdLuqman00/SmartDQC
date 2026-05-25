"""Tests for the admin-gated KPI-targets settings endpoints."""
import pytest
from fastapi.testclient import TestClient
import backend.main as main
from backend.main import app
from backend.db.models import User
from backend.auth import hash_password


@pytest.fixture
def client(override_get_db):
    return TestClient(app)


def _token(client, db_session, username, role):
    db_session.add(User(
        username=username,
        password_hash=hash_password("pw"),
        role=role,
        is_active=True,
    ))
    db_session.commit()
    login = client.post("/auth/login", data={"username": username, "password": "pw"})
    return login.json()["access_token"]


def test_get_returns_official_defaults(client):
    resp = client.get("/settings/kpi-targets")
    assert resp.status_code == 200
    body = resp.json()
    assert body["defaults"]["npan"]["stunting_rate"] == 15.0
    assert body["defaults"]["who"]["stunting_rate"] == 20.0
    # No override stored yet -> source marks official.
    assert body["source"]["npan"] == "npan_2021_2025"
    assert body["source"]["who"] == "who_2025"


def test_non_admin_cannot_update(client, db_session):
    token = _token(client, db_session, "analyst1", "analyst")
    resp = client.post(
        "/settings/kpi-targets",
        json={"npan": {"stunting_rate": 5.0}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_unauthenticated_cannot_update(client):
    resp = client.post("/settings/kpi-targets", json={"npan": {"stunting_rate": 5.0}})
    assert resp.status_code in (401, 422)  # missing Authorization header


def test_admin_update_persists_and_audits(client, db_session, monkeypatch):
    # _log_audit opens its own SessionLocal, not the test session, so capture
    # the call directly to assert it records the acting user_id.
    calls = []

    def fake_audit(*args, **kwargs):
        rec = dict(kwargs)
        if args:
            rec["action"] = args[0]
        calls.append(rec)

    monkeypatch.setattr(main, "_log_audit", fake_audit)

    token = _token(client, db_session, "admin1", "admin")
    resp = client.post(
        "/settings/kpi-targets",
        json={"npan": {"stunting_rate": 5.0}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["current"]["npan"]["stunting_rate"] == 5.0
    assert body["source"]["npan"] == "custom"
    # Other set untouched.
    assert body["current"]["who"]["stunting_rate"] == 20.0

    # GET reflects the override.
    assert client.get("/settings/kpi-targets").json()["current"]["npan"]["stunting_rate"] == 5.0

    # Audit recorded with the acting user_id.
    admin = db_session.query(User).filter_by(username="admin1").first()
    assert any(c.get("action") == "settings.kpi_targets" and c.get("user_id") == admin.id
               for c in calls)


def test_rejects_out_of_range_value(client, db_session):
    token = _token(client, db_session, "admin2", "admin")
    resp = client.post(
        "/settings/kpi-targets",
        json={"npan": {"stunting_rate": 250.0}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_rejects_unknown_key(client, db_session):
    token = _token(client, db_session, "admin3", "admin")
    resp = client.post(
        "/settings/kpi-targets",
        json={"npan": {"made_up_rate": 5.0}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
