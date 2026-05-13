import pandas as pd
import pytest
from backend.ml.risk_score import compute_risk_scores

@pytest.fixture
def healthy_df():
    """100 children, no nutritional flags set."""
    return pd.DataFrame({
        "stunting":    [0] * 100,
        "wasting":     [0] * 100,
        "underweight": [0] * 100,
        "overweight":  [0] * 100,
        "NEGERI":      ["Selangor"] * 50 + ["Johor"] * 50,
    })

@pytest.fixture
def high_risk_df():
    """10 children all severely flagged."""
    return pd.DataFrame({
        "stunting":          [1] * 10,
        "wasting":           [1] * 10,
        "underweight":       [1] * 10,
        "severely_stunted":  [1] * 10,
        "severely_wasted":   [1] * 10,
        "NEGERI":            ["Kelantan"] * 10,
    })

@pytest.fixture
def mixed_df(healthy_df, high_risk_df):
    return pd.concat([healthy_df, high_risk_df], ignore_index=True)

def test_returns_required_keys(healthy_df):
    result = compute_risk_scores(healthy_df)
    for key in ["total_records", "flags_used", "distribution",
                "avg_risk_score", "high_risk_count", "high_risk_sample"]:
        assert key in result

def test_healthy_children_have_zero_avg_risk(healthy_df):
    result = compute_risk_scores(healthy_df)
    assert result["avg_risk_score"] == 0.0

def test_high_risk_children_flagged(high_risk_df):
    result = compute_risk_scores(high_risk_df)
    assert result["high_risk_count"] == 10

def test_risk_score_capped_at_100(high_risk_df):
    result = compute_risk_scores(high_risk_df)
    for row in result["high_risk_sample"]:
        assert row["risk_score"] <= 100.0

def test_distribution_sums_to_total(mixed_df):
    result = compute_risk_scores(mixed_df)
    total = sum(result["distribution"].values())
    assert total == len(mixed_df)

def test_district_summary_present_when_negeri_col_exists(mixed_df):
    result = compute_risk_scores(mixed_df)
    assert result["district_summary"] is not None
    districts = [r["district"] for r in result["district_summary"]]
    assert "Selangor" in districts
    assert "Kelantan" in districts

def test_no_district_summary_when_no_negeri_col():
    df = pd.DataFrame({"stunting": [0, 1, 0], "wasting": [0, 0, 1]})
    result = compute_risk_scores(df)
    assert result["district_summary"] is None

def test_empty_df_does_not_crash():
    df = pd.DataFrame({"stunting": pd.Series([], dtype=int)})
    result = compute_risk_scores(df)
    assert result["total_records"] == 0
    assert result["flags_used"] == []
