"""Phase 5C step 5 — verify clean_general applies approved portable rules
when their codes appear in enabled_rules.

Each test enables exactly one portable rule code and confirms:
  - stat counter fires (count > 0)
  - flagged rows carry the code in exclude_reason
  - un-approved rules stay zero (isolation)
"""
import os
import pathlib

import pandas as pd

_ZDIR = pathlib.Path(__file__).resolve().parents[2] / "data" / "zscore"
os.environ.setdefault("WHO_ZSCORE_DIR", str(_ZDIR))

from backend.eda import cleaning  # noqa: E402


def _codes(exclude_reason: str) -> set[str]:
    return {c.strip() for c in str(exclude_reason).split(";") if c.strip()}


# ── dropped_pendapatan_x ──────────────────────────────────────────────────────

def test_general_applies_dropped_pendapatan_x():
    df = pd.DataFrame({
        "Jantina":       ["L", "P"],
        "Tarikh Lahir":  ["2019-01-01", "2019-01-01"],
        "Tarikh Ukur":   ["2022-06-01", "2022-06-01"],
        "Pendapatan":    ["3000", "X"],
        "Berat":         [16.0, 16.0],
        "Tinggi":        [105.0, 105.0],
    })
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_pendapatan_x"})
    assert stats["dropped_pendapatan_x"] == 1
    assert "dropped_pendapatan_x" in _codes(
        cleaned[cleaned["exclude_reason"].str.contains("dropped_pendapatan_x", na=False)]
        .iloc[0]["exclude_reason"]
    )


# ── dropped_null_dob ──────────────────────────────────────────────────────────

def test_general_applies_dropped_null_dob():
    df = pd.DataFrame({
        "Jantina":       ["L", "P"],
        "Tarikh Lahir":  ["2019-01-01", None],
        "Tarikh Ukur":   ["2022-06-01", "2022-06-01"],
        "Berat":         [16.0, 16.0],
        "Tinggi":        [105.0, 105.0],
    })
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_null_dob"})
    assert stats["dropped_null_dob"] == 1
    flagged = cleaned[cleaned["exclude_reason"].str.contains("dropped_null_dob", na=False)]
    assert len(flagged) == 1


# ── dropped_age_over5 ─────────────────────────────────────────────────────────

def test_general_applies_dropped_age_over5():
    df = pd.DataFrame({
        "Jantina":       ["L", "L"],
        "Tarikh Lahir":  ["2021-01-01", "2014-01-01"],
        "Tarikh Ukur":   ["2023-01-01", "2023-01-01"],
        "Berat":         [12.0, 12.0],
        "Tinggi":        [85.0, 85.0],
    })
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_age_over5"})
    assert stats["dropped_age_over5"] == 1
    assert "dropped_age_over5" in _codes(cleaned.iloc[1]["exclude_reason"])


# ── dropped_ragu_gender ───────────────────────────────────────────────────────

def test_general_applies_dropped_ragu_gender():
    df = pd.DataFrame({
        "Jantina":       ["L", "RAGU"],
        "Tarikh Lahir":  ["2015-01-01", "2015-01-01"],
        "Tarikh Ukur":   ["2023-01-01", "2023-01-01"],
        "Berat":         [30.0, 30.0],
        "Tinggi":        [130.0, 130.0],
    })
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_ragu_gender"})
    assert stats["dropped_ragu_gender"] == 1
    assert "dropped_ragu_gender" in _codes(cleaned.iloc[1]["exclude_reason"])


# ── dropped_duplicate_mykid ───────────────────────────────────────────────────

def test_general_applies_dropped_duplicate_mykid():
    df = pd.DataFrame({
        "No. MyKID":     ["KID001",     "KID001",     "KID002"],
        "Jantina":       ["L",          "L",          "P"],
        "Tarikh Lahir":  ["2019-01-01", "2019-01-01", "2019-01-01"],
        "Tarikh Ukur":   ["2022-01-01", "2023-06-01", "2023-06-01"],
        "Berat":         [16.0,         16.5,         16.0],
        "Tinggi":        [105.0,        106.0,        105.0],
    })
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_duplicate_mykid"})
    assert stats["dropped_duplicate_mykid"] == 1
    dup_rows = cleaned[cleaned["exclude_reason"].str.contains(
        "dropped_duplicate_mykid", na=False)]
    assert len(dup_rows) == 1
    assert dup_rows.iloc[0]["Tarikh_Ukur"] == pd.Timestamp("2022-01-01")


# ── isolation: unapproved rule stays zero ─────────────────────────────────────

def test_general_portable_rule_zero_when_not_in_enabled_rules():
    df = pd.DataFrame({
        "Jantina":       ["L", "P"],
        "Tarikh Lahir":  ["2019-01-01", None],
        "Tarikh Ukur":   ["2022-06-01", "2022-06-01"],
        "Berat":         [16.0, 16.0],
        "Tinggi":        [105.0, 105.0],
    })
    # dropped_null_dob would fire on row 1, but it's NOT in enabled_rules
    cleaned, stats = cleaning.clean_data(df, "general",
                                         enabled_rules={"dropped_invalid_gender"})
    assert stats.get("dropped_null_dob", 0) == 0
    assert cleaned.iloc[1]["analyzable"]  # row not excluded
