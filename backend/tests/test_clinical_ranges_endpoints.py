"""HTTP-layer coverage for the clinical-ranges config endpoints
(GET/PUT /config/clinical-ranges): registry shape + per-key `editable` flag,
override persistence round-trip, schema validation (422), and tier-governance
hardening (read-only reference keys rejected).

The cleaning EFFECT of an override is proven separately in
test_clinical_ranges_propagation.py; this file pins the API contract only.
Uses the shared in-memory-SQLite `client_with_db` fixture (conftest.py).
"""

import backend.clinical_ranges as CR


def test_get_returns_full_registry_with_editable_flags(client_with_db):
    r = client_with_db.get("/config/clinical-ranges")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == len(CR.RANGES)  # every key is surfaced
    editable = {k for k, v in body.items() if v["editable"]}
    assert editable == set(CR.EDITABLE_KEYS)
    # representative editable + read-only entries carry the fields the UI needs
    assert body["bmi_max"]["editable"] is True
    assert body["biv_waz"]["editable"] is False
    assert "source" in body["biv_waz"] and "tier" in body["biv_waz"]


def test_put_value_override_persists_and_roundtrips(client_with_db):
    r = client_with_db.put("/config/clinical-ranges", json={"bmi_max": {"value": 35.0}})
    assert r.status_code == 200
    assert r.json()["bmi_max"]["effective_value"] == 35.0
    assert r.json()["bmi_max"]["overridden"] is True
    # persisted: a fresh GET reflects the saved override, default untouched
    g = client_with_db.get("/config/clinical-ranges").json()
    assert g["bmi_max"]["effective_value"] == 35.0
    assert g["bmi_max"]["overridden"] is True
    assert g["bmi_max"]["default_value"] == 40.0


def test_put_range_override_persists(client_with_db):
    r = client_with_db.put("/config/clinical-ranges",
                           json={"school_weight": {"min": 14.0, "max": 48.0}})
    assert r.status_code == 200
    body = r.json()
    assert body["school_weight"]["effective_min"] == 14.0
    assert body["school_weight"]["effective_max"] == 48.0
    assert body["school_weight"]["overridden"] is True


def test_put_readonly_key_rejected_422(client_with_db):
    # biv_waz is WHO-tier reference — tier governance must reject the override
    r = client_with_db.put("/config/clinical-ranges",
                           json={"biv_waz": {"min": -6.0, "max": 5.0}})
    assert r.status_code == 422
    errs = r.json()["detail"]["errors"]
    assert any("read-only" in e.lower() for e in errs)
    # nothing persisted
    g = client_with_db.get("/config/clinical-ranges").json()
    assert g["biv_waz"]["overridden"] is False


def test_put_invalid_range_rejected_422(client_with_db):
    # min >= max fails schema validation (validate_overrides) before persistence
    r = client_with_db.put("/config/clinical-ranges",
                           json={"school_weight": {"min": 60.0, "max": 50.0}})
    assert r.status_code == 422


def test_put_unknown_key_rejected_422(client_with_db):
    r = client_with_db.put("/config/clinical-ranges", json={"not_a_real_key": {"value": 1.0}})
    assert r.status_code == 422
