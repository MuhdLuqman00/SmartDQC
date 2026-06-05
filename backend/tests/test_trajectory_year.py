"""E1a — configurable forecast target year.

The trajectory used to print a hard-coded "2027". The forecast year is now
derived: the admin-configured target_year, or the latest data year + the
default horizon when unset. The OLS is fit on the actual years so projecting
to a calendar year is exact and gap-safe.
"""
from backend.eda.kpi import compute_trajectory_narratives


def _snaps(rates_by_year):
    """One district, stunting_rate per year; other indicators absent."""
    return [
        {
            "district": "D1", "period": str(y), "stunting_rate": r,
            "wasting_rate": None, "underweight_rate": None, "overweight_rate": None,
        }
        for y, r in rates_by_year.items()
    ]


def _stunting(out):
    return next(r for r in out if r["kpi_key"] == "stunting_rate")


def test_forecast_year_defaults_to_latest_plus_horizon():
    # latest year 2023, default horizon 4 → 2027 (no longer hard-coded)
    row = _stunting(compute_trajectory_narratives(_snaps({2022: 30.0, 2023: 28.0}), []))
    assert row["forecast_year"] == 2027


def test_configured_target_year_drives_year_and_rate():
    # slope -2pp/yr from (2022,30)->(2023,28); projected to 2030 → 14.0%
    row = _stunting(compute_trajectory_narratives(
        _snaps({2022: 30.0, 2023: 28.0}), [], target_year=2030))
    assert row["forecast_year"] == 2030
    assert row["forecast_2027"] == 14.0  # forecast_2027 holds the RATE


def test_target_year_clamped_forward():
    # a past/near target still projects forward (latest_year + 1)
    row = _stunting(compute_trajectory_narratives(
        _snaps({2022: 30.0, 2023: 28.0}), [], target_year=2021))
    assert row["forecast_year"] == 2024


def test_year_appears_in_narrative_not_2027():
    row = _stunting(compute_trajectory_narratives(
        _snaps({2022: 30.0, 2023: 28.0}), [], target_year=2030))
    assert "2030" in row["narrative"]["en"]
    assert "2027" not in row["narrative"]["en"]
