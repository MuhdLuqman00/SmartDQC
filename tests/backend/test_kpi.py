import pandas as pd
import pytest
from backend.eda.kpi import compute_kpi_dashboard

@pytest.fixture
def green_df():
    """All rates well below national targets."""
    return pd.DataFrame({
        "stunting":    [1] * 20  + [0] * 180,   # 10%  — target 15%  — Green
        "wasting":     [1] * 6   + [0] * 194,   # 3%   — target 5%   — Green
        "underweight": [1] * 20  + [0] * 180,   # 10%  — target 12%  — Green
        "overweight":  [1] * 15  + [0] * 185,   # 7.5% — target 10%  — Green
        "NEGERI":      ["Selangor"] * 100 + ["Johor"] * 100,
    })

@pytest.fixture
def red_df():
    """All rates far above national targets."""
    return pd.DataFrame({
        "stunting":    [1] * 40 + [0] * 60,     # 40% — target 15% — Red
        "wasting":     [1] * 20 + [0] * 80,     # 20% — target 5%  — Red
        "underweight": [1] * 30 + [0] * 70,     # 30% — target 12% — Red
        "overweight":  [1] * 25 + [0] * 75,     # 25% — target 10% — Red
        "NEGERI":      ["Kelantan"] * 50 + ["Sabah"] * 50,
    })

def test_npan_override_flips_rag(green_df):
    """A stricter NPAN target turns a Green indicator Red.

    Stunting is 10% — Green at the official 15% target. Lowering the target to
    5% makes 10% > 5%*1.2, so it must flip to Red and overall_status follows.
    """
    result = compute_kpi_dashboard(green_df, npan={"stunting_rate": 5.0})
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["npan_target"] == 5.0
    assert stunting["rag"] == "Red"
    assert result["overall_status"] == "Red"


def test_who_override_flows_to_who_target_and_status(green_df):
    result = compute_kpi_dashboard(green_df, who={"stunting_rate": 8.0})
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["who_target"] == 8.0
    # 10% stunting vs WHO target 8% -> 10 > 8*1.2=9.6 -> Red
    assert stunting["who_status"] == "Red"


def test_defaults_unchanged_without_override(green_df):
    result = compute_kpi_dashboard(green_df)
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["npan_target"] == 15.0
    assert stunting["who_target"] == 20.0


def test_partial_override_keeps_other_targets_and_labels(green_df):
    """Overriding only stunting must not drop other indicators or alter labels."""
    result = compute_kpi_dashboard(green_df, npan={"stunting_rate": 5.0})
    keys = {k["key"] for k in result["indicators"]}
    assert keys == {"stunting", "wasting", "underweight", "overweight"}
    wasting = next(k for k in result["indicators"] if k["key"] == "wasting")
    assert wasting["npan_target"] == 5.0  # official wasting target, untouched
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["label_en"] == "Stunting Rate"


def test_override_flows_into_state_breakdown(green_df):
    """Per-state RAG must use the overridden target too, not the default.

    In green_df all stunting cases fall in Selangor (20/100 = 20%), so at the
    overridden target of 5% Selangor must be Red — proving the override reached
    the per-group breakdown, not just the headline indicators.
    """
    result = compute_kpi_dashboard(green_df, npan={"stunting_rate": 5.0})
    selangor = next(r for r in result["by_state"] if r["state"] == "Selangor")
    assert selangor["status"]["stunting"] == "Red"


def test_returns_required_keys(green_df):
    result = compute_kpi_dashboard(green_df)
    assert "indicators" in result
    assert "overall_status" in result
    assert "by_state" in result

def test_green_overall_status(green_df):
    result = compute_kpi_dashboard(green_df)
    assert result["overall_status"] == "Green"

def test_red_overall_status(red_df):
    result = compute_kpi_dashboard(red_df)
    assert result["overall_status"] == "Red"

def test_kpi_entries_have_required_keys(green_df):
    result = compute_kpi_dashboard(green_df)
    for kpi in result["indicators"]:
        for key in ["key", "npan_target", "actual", "actual_count", "total", "rag", "gap"]:
            assert key in kpi

def test_stunting_green_when_below_target(green_df):
    result = compute_kpi_dashboard(green_df)
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["rag"] == "Green"

def test_stunting_red_when_far_above_target(red_df):
    result = compute_kpi_dashboard(red_df)
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["rag"] == "Red"

def test_income_breakdown_present_when_income_col():
    df = pd.DataFrame({
        "stunting":    [1] * 10 + [0] * 30,
        "wasting":     [0] * 40,
        "underweight": [0] * 40,
        "overweight":  [0] * 40,
        "pendapatan":  ["B40"] * 20 + ["M40"] * 12 + ["T20"] * 8,
    })
    result = compute_kpi_dashboard(df)
    assert "by_income" in result
    groups = [r["income"] for r in result["by_income"]]
    assert {"B40", "M40", "T20"} <= set(groups)
    # each group carries per-indicator rates, like the other breakdowns
    assert all("rates" in r and "status" in r for r in result["by_income"])


def test_no_income_breakdown_without_income_col(green_df):
    # green_df has no income column → empty list, not an error
    assert compute_kpi_dashboard(green_df)["by_income"] == []


def test_district_breakdown_present_when_negeri_col(green_df):
    result = compute_kpi_dashboard(green_df)
    assert result["by_state"]
    names = [r["state"] for r in result["by_state"]]
    assert "Selangor" in names and "Johor" in names

def test_no_district_breakdown_without_negeri_col():
    df = pd.DataFrame({"stunting": [0, 1, 0] * 10, "wasting": [0, 0, 1] * 10})
    result = compute_kpi_dashboard(df)
    assert result["by_state"] == []

def test_gap_equals_actual_minus_target(green_df):
    result = compute_kpi_dashboard(green_df)
    for kpi in result["indicators"]:
        assert abs(kpi["gap"] - round(kpi["actual"] - kpi["npan_target"], 2)) < 0.01

def test_empty_df_returns_empty_kpis():
    df = pd.DataFrame({"stunting": pd.Series([], dtype=int)})
    result = compute_kpi_dashboard(df)
    assert result["indicators"] == []
    assert result["overall_status"] == "Green"

def test_amber_boundary():
    # 17% stunting — above 15% target but below 15% * 1.20 = 18% ceiling → Amber
    df = pd.DataFrame({"stunting": [1] * 17 + [0] * 83})
    result = compute_kpi_dashboard(df)
    stunting = next(k for k in result["indicators"] if k["key"] == "stunting")
    assert stunting["rag"] == "Amber", (
        f"Expected Amber for 17% stunting (target 15%, ceiling 18%), got {stunting['rag']}"
    )
