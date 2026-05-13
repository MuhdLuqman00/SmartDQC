"""
Composite nutritional risk scoring.
Reads indicator flag columns produced by backend/eda/indicators.py.
Returns per-child risk score (0-100) and district-level aggregation.
"""
import pandas as pd

_RISK_WEIGHTS: dict[str, int] = {
    "stunting":             25,
    "wasting":              30,
    "underweight":          20,
    "overweight":           15,
    "severely_stunted":     40,
    "severely_wasted":      50,
    "severely_underweight": 40,
}

_DISTRICT_COLS = ["NEGERI", "STATE", "negeri", "state", "Negeri", "State"]
_TIER_BINS     = [-1, 20, 50, 100]
_TIER_LABELS   = ["Low", "Medium", "High"]


def compute_risk_scores(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "total_records": 0, "flags_used": [], "distribution": {},
            "avg_risk_score": 0.0, "high_risk_count": 0,
            "district_summary": None, "high_risk_sample": [],
        }

    available_flags = [f for f in _RISK_WEIGHTS if f in df.columns]

    if available_flags:
        risk = pd.Series(0.0, index=df.index)
        for flag in available_flags:
            risk = risk + df[flag].fillna(0).astype(bool).astype(float) * _RISK_WEIGHTS[flag]
    else:
        risk = pd.Series(0.0, index=df.index)
    risk = risk.clip(0, 100)

    tier = pd.cut(risk, bins=_TIER_BINS, labels=_TIER_LABELS)
    distribution = tier.value_counts().to_dict()

    district_col = next((c for c in _DISTRICT_COLS if c in df.columns), None)
    district_summary = None
    if district_col:
        tmp = df[[district_col]].copy()
        tmp["risk_score"] = risk
        district_summary = (
            tmp.groupby(district_col)["risk_score"]
            .agg(avg_risk="mean", max_risk="max", n_records="count")
            .round(2)
            .reset_index()
            .rename(columns={district_col: "district"})
            .to_dict(orient="records")
        )

    key_cols = [c for c in (
        ["IC_NO_PASSPORT", "NAMA", district_col] + available_flags
    ) if c and c in df.columns]
    tmp_full = df[key_cols].copy()
    tmp_full["risk_score"] = risk
    tmp_full["risk_tier"]  = tier.astype(str)
    high_risk_sample = (
        tmp_full[tmp_full["risk_tier"] == "High"]
        .head(50)
        .to_dict(orient="records")
    )

    return {
        "total_records":   len(df),
        "flags_used":      available_flags,
        "distribution":    {str(k): int(v) for k, v in distribution.items()},
        "avg_risk_score":  round(float(risk.mean()), 2),
        "high_risk_count": int((tier == "High").sum()),
        "district_summary": district_summary,
        "high_risk_sample": high_risk_sample,
    }
