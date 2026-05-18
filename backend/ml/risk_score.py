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

# Accept Bahasa Ind_* columns produced by the MyVASS/KPM cleaners
_FLAG_ALIASES: dict[str, tuple[str, ...]] = {
    "stunting":             ("stunting", "Ind_Bantut"),
    "wasting":              ("wasting", "Ind_Susut"),
    "underweight":          ("underweight", "Ind_Kurang_Berat_Badan"),
    "overweight":           ("overweight", "Ind_Berlebihan_BB"),
    "severely_stunted":     ("severely_stunted",),
    "severely_wasted":      ("severely_wasted",),
    "severely_underweight": ("severely_underweight",),
}

_DISTRICT_COLS = ["NEGERI", "STATE", "negeri", "state", "Negeri", "State"]
_TIER_BINS     = [-1, 20, 50, 100]
_TIER_LABELS   = ["Low", "Medium", "High"]


def _resolve_col(df: pd.DataFrame, flag: str) -> str | None:
    for candidate in _FLAG_ALIASES.get(flag, (flag,)):
        if candidate in df.columns:
            return candidate
    return None


def compute_risk_scores(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "total_records": 0, "flags_used": [], "distribution": {},
            "avg_risk_score": 0.0, "high_risk_count": 0,
            "district_summary": None, "high_risk_sample": [],
        }

    flag_cols = {f: _resolve_col(df, f) for f in _RISK_WEIGHTS}
    flag_cols = {f: col for f, col in flag_cols.items() if col is not None}
    available_flags = list(flag_cols.keys())

    risk = pd.Series(0.0, index=df.index)
    for flag, col in flag_cols.items():
        risk = risk + df[col].fillna(0).astype(bool).astype(float) * _RISK_WEIGHTS[flag]
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

    actual_flag_cols = list(flag_cols.values())
    key_cols = [c for c in (
        ["IC_NO_PASSPORT", "NAMA", district_col] + actual_flag_cols
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
