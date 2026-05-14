"""Multi-dataset comparative analysis.

compare_datasets() takes 2+ summary dicts (oldest first) and returns
side-by-side deltas and OLS trend directions per indicator.
"""
from __future__ import annotations
from typing import Any

_INDICATOR_KEYS = [
    "stunting_rate", "wasting_rate", "underweight_rate", "overweight_rate",
]


def _rate_delta(later: float | None, earlier: float | None) -> float | None:
    """Percentage-point delta (later - earlier) × 100. None if either missing."""
    if earlier is None or earlier == 0.0 or later is None:
        return None
    return round((later - earlier) * 100, 2)


def _quality_delta(later: int | None, earlier: int | None) -> float | None:
    if earlier is None or later is None:
        return None
    return round(float(later - earlier), 2)


def _trend_direction(values: list[float]) -> str:
    """OLS slope over the series → 'improving' / 'worsening' / 'stable'."""
    if len(values) < 2:
        return "insufficient_data"
    import numpy as np
    slope = float(np.polyfit(range(len(values)), values, 1)[0])
    if abs(slope) < 0.001:
        return "stable"
    return "improving" if slope < 0 else "worsening"


def compare_datasets(summaries: list[dict[str, Any]]) -> dict[str, Any]:
    """Compare 2+ dataset summaries (oldest → latest).

    Each summary: {dataset_id, source_type, quality_score, indicators: {key: float}}
    Returns:      {datasets, deltas, trend}
    """
    if len(summaries) < 2:
        return {"datasets": summaries, "deltas": {}, "trend": {}}

    earliest, latest = summaries[0], summaries[-1]

    deltas: dict[str, Any] = {}
    deltas["quality_score"] = _quality_delta(
        latest.get("quality_score"), earliest.get("quality_score")
    )
    for key in _INDICATOR_KEYS:
        deltas[key] = _rate_delta(
            latest.get("indicators", {}).get(key),
            earliest.get("indicators", {}).get(key),
        )

    trend: dict[str, str] = {}
    qs_vals = [float(s["quality_score"]) for s in summaries if s.get("quality_score") is not None]
    trend["quality_score"] = _trend_direction(qs_vals)
    for key in _INDICATOR_KEYS:
        vals = [s.get("indicators", {}).get(key) for s in summaries]
        trend[key] = _trend_direction([v for v in vals if v is not None])

    return {"datasets": summaries, "deltas": deltas, "trend": trend}
