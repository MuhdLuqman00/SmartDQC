"""
KPI dashboard: measure indicator flag rates against Malaysian national targets
and assign RAG (Red/Amber/Green) traffic-light status.

Targets from NPAN (National Plan of Action for Nutrition) and 12th Malaysia Plan.
"""
import pandas as pd

_NATIONAL_KPIS: dict[str, dict] = {
    "stunting_rate":    {"target": 15.0, "label_bm": "Kadar Stunting",          "label_en": "Stunting Rate"},
    "wasting_rate":     {"target": 5.0,  "label_bm": "Kadar Wasting",           "label_en": "Wasting Rate"},
    "underweight_rate": {"target": 12.0, "label_bm": "Kadar Kekurangan Berat",  "label_en": "Underweight Rate"},
    "overweight_rate":  {"target": 10.0, "label_bm": "Kadar Berlebihan Berat",  "label_en": "Overweight Rate"},
}

_FLAG_TO_KPI: dict[str, str] = {
    "stunting":    "stunting_rate",
    "wasting":     "wasting_rate",
    "underweight": "underweight_rate",
    "overweight":  "overweight_rate",
}

_DISTRICT_COLS = ["NEGERI", "STATE", "negeri", "state", "Negeri", "State"]


def _rag(actual: float, target: float) -> str:
    if actual <= target:
        return "Green"
    if actual <= target * 1.20:
        return "Amber"
    return "Red"


def compute_kpi_dashboard(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"kpis": [], "overall_status": "Green", "district_breakdown": None}

    total = len(df)
    kpis  = []

    for flag_col, kpi_key in _FLAG_TO_KPI.items():
        if flag_col not in df.columns:
            continue
        count  = int(df[flag_col].fillna(0).astype(bool).sum())
        actual = round(count / total * 100, 2)
        target = _NATIONAL_KPIS[kpi_key]["target"]
        kpis.append({
            "kpi":          kpi_key,
            **_NATIONAL_KPIS[kpi_key],
            "actual":       actual,
            "actual_count": count,
            "total":        total,
            "status":       _rag(actual, target),
            "gap":          round(actual - target, 2),
        })

    district_col = next((c for c in _DISTRICT_COLS if c in df.columns), None)
    district_breakdown = None
    if district_col and kpis:
        rows = []
        for district, grp in df.groupby(district_col):
            n     = len(grp)
            entry = {"district": str(district), "n_records": n}
            for flag_col, kpi_key in _FLAG_TO_KPI.items():
                if flag_col not in grp.columns:
                    continue
                rate   = round(grp[flag_col].fillna(0).astype(bool).sum() / n * 100, 2)
                target = _NATIONAL_KPIS[kpi_key]["target"]
                entry[f"{kpi_key}_rate"]   = rate
                entry[f"{kpi_key}_status"] = _rag(rate, target)
            rows.append(entry)
        district_breakdown = rows

    statuses = [k["status"] for k in kpis]
    overall  = "Red" if "Red" in statuses else ("Amber" if "Amber" in statuses else "Green")

    return {"kpis": kpis, "overall_status": overall, "district_breakdown": district_breakdown}
