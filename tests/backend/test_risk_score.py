import numpy as np
import pandas as pd
import pytest

from backend.ml.risk_score import compute_risk_scores


@pytest.fixture
def healthy_df():
    """50 children with normal anthropometry (all z-scores >= -2)."""
    return pd.DataFrame({
        "WAZ":    [0.0] * 50,
        "HAZ":    [-0.5] * 50,
        "BAZ":    [0.2] * 50,
        "Age_Months": [36.0] * 50,
        "NEGERI": ["Selangor"] * 25 + ["Johor"] * 25,
    })


def test_returns_required_keys(healthy_df):
    result = compute_risk_scores(healthy_df)
    for key in ["total_records", "scored_records", "incomplete_count",
                "flags_used", "distribution", "avg_risk_score",
                "high_risk_count", "district_summary"]:
        assert key in result
    # No per-child roster is exposed anymore.
    assert "high_risk_sample" not in result


def test_healthy_children_score_zero_and_low(healthy_df):
    result = compute_risk_scores(healthy_df)
    assert result["avg_risk_score"] == 0.0
    assert result["distribution"].get("Low", 0) == 50
    assert result["high_risk_count"] == 0


def test_severity_is_preserved():
    """A severely wasted child must score materially higher than a moderate one."""
    moderate = compute_risk_scores(pd.DataFrame({"BAZ": [-2.5], "Age_Months": [36.0]}))
    severe = compute_risk_scores(pd.DataFrame({"BAZ": [-4.0], "Age_Months": [36.0]}))
    assert severe["avg_risk_score"] > moderate["avg_risk_score"]


def test_single_severe_indicator_reaches_high():
    """SAM (severe wasting) alone must land in the High tier (>= 67)."""
    result = compute_risk_scores(pd.DataFrame({"BAZ": [-4.0], "Age_Months": [36.0]}))
    assert result["high_risk_count"] == 1
    assert result["avg_risk_score"] >= 67


def test_missing_measurements_are_incomplete_not_low():
    """Children with no z-scores are 'Incomplete', excluded from the average."""
    df = pd.DataFrame({
        "WAZ": [np.nan, -4.0],
        "HAZ": [np.nan, -0.5],
        "BAZ": [np.nan, 0.0],
        "Age_Months": [36.0, 36.0],
    })
    result = compute_risk_scores(df)
    assert result["incomplete_count"] == 1
    assert result["scored_records"] == 1
    assert result["distribution"].get("Incomplete", 0) == 1
    # avg is over the single scored child only, not diluted by the incomplete one.
    assert result["avg_risk_score"] > 0


def test_distribution_sums_to_total():
    df = pd.DataFrame({
        "WAZ": [0.0, -4.0, np.nan],
        "HAZ": [0.0, -0.5, np.nan],
        "BAZ": [0.0, 0.0, np.nan],
        "Age_Months": [36.0, 36.0, 36.0],
    })
    result = compute_risk_scores(df)
    assert sum(result["distribution"].values()) == result["total_records"] == 3


def test_district_summary_present_with_state_col(healthy_df):
    result = compute_risk_scores(healthy_df)
    assert result["district_summary"] is not None
    districts = [r["district"] for r in result["district_summary"]]
    assert "Selangor" in districts and "Johor" in districts


def test_no_district_summary_without_state_col():
    df = pd.DataFrame({"WAZ": [0.0, -4.0], "BAZ": [0.0, 0.0]})
    result = compute_risk_scores(df)
    assert result["district_summary"] is None


def test_consecutive_underweight_raises_score():
    """A child underweight across consecutive visits scores higher than a one-off."""
    single = compute_risk_scores(pd.DataFrame({
        "IC_NO_PASSPORT": ["X"],
        "Tarikh_Ukur":    pd.to_datetime(["2025-04-01"]),
        "WAZ":            [-2.5],
        "Age_Months":     [33.0],
    }))
    sustained = compute_risk_scores(pd.DataFrame({
        "IC_NO_PASSPORT": ["B", "B", "B"],
        "Tarikh_Ukur":    pd.to_datetime(["2025-01-01", "2025-04-01", "2025-07-01"]),
        "WAZ":            [-2.5, -2.5, -2.5],
        "Age_Months":     [30.0, 33.0, 36.0],
    }))
    # The sustained child's worst visit (3 consecutive underweight readings)
    # carries the full longitudinal penalty, so the cohort max exceeds a one-off.
    sustained_max = max(d["max_risk"] for d in sustained["district_summary"]) \
        if sustained["district_summary"] else sustained["avg_risk_score"]
    assert sustained_max > single["avg_risk_score"]


def test_empty_df_does_not_crash():
    result = compute_risk_scores(pd.DataFrame({"WAZ": pd.Series([], dtype=float)}))
    assert result["total_records"] == 0
    assert result["flags_used"] == []
