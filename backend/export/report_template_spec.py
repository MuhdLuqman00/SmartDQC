"""KKM report template constants — section labels, colours, targets, column defs."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Colours (hex strings, used by both PDF and PPTX builders)
# ---------------------------------------------------------------------------
KKM_TEAL        = "#00697A"   # MOH Malaysia primary
KKM_TEAL_DARK   = "#004F5C"
KKM_TEAL_LIGHT  = "#E6F4F5"
KKM_NAVY        = "#1A3A5C"
KKM_WHITE       = "#FFFFFF"
KKM_LIGHT_GRAY  = "#F5F7F8"
KKM_MID_GRAY    = "#64748B"
KKM_RULE_LINE   = "#C8D8DC"

STATUS_ON_TRACK  = "#2D7A4F"   # green
STATUS_AT_RISK   = "#E8A020"   # amber
STATUS_OFF_TRACK = "#C0392B"   # red
STATUS_NEUTRAL   = "#64748B"   # grey fallback

# ---------------------------------------------------------------------------
# Section labels (BM / EN pairs)
# ---------------------------------------------------------------------------
SECTION_LABELS: dict[str, dict[str, str]] = {
    "cover": {
        "bm": "LAPORAN PEMAKANAN",
        "en": "NUTRITION REPORT",
    },
    "executive_summary": {
        "bm": "RINGKASAN EKSEKUTIF",
        "en": "EXECUTIVE SUMMARY",
    },
    "nutritional_status": {
        "bm": "STATUS PEMAKANAN MENGIKUT DAERAH",
        "en": "NUTRITIONAL STATUS BY DISTRICT",
    },
    "kpi_achievement": {
        "bm": "PENCAPAIAN KPI BERBANDING SASARAN NPAN / WHO",
        "en": "KPI ACHIEVEMENT VS NPAN / WHO TARGETS",
    },
    "trajectory": {
        "bm": "TRAJEKTORI & NARATIF DAERAH",
        "en": "DISTRICT TRAJECTORY & NARRATIVE",
    },
    "at_risk": {
        "bm": "SENARAI KANAK-KANAK BERISIKO",
        "en": "AT-RISK CHILDREN LIST",
    },
    "quality_overview": {
        "bm": "GAMBARAN KESELURUHAN KUALITI DATA",
        "en": "DATA QUALITY OVERVIEW",
    },
    "recommendations": {
        "bm": "CADANGAN TINDAKAN",
        "en": "RECOMMENDATIONS",
    },
    "indicator_table": {
        "bm": "JADUAL PETUNJUK MENGIKUT DAERAH",
        "en": "INDICATOR TABLE BY DISTRICT",
    },
    "methodology": {
        "bm": "LAMPIRAN METODOLOGI",
        "en": "METHODOLOGY APPENDIX",
    },
}

# ---------------------------------------------------------------------------
# Footer template
# ---------------------------------------------------------------------------
FOOTER_TEMPLATE = "{district} | LAPORAN SmartDQC {year} | Kementerian Kesihatan Malaysia"

# ---------------------------------------------------------------------------
# KPI table column definitions
# ---------------------------------------------------------------------------
KPI_TABLE_HEADERS = {
    "bm": ["Petunjuk", "Sebenar (%)", "Sasaran NPAN (%)", "Sasaran WHO (%)", "Status NPAN", "Status WHO"],
    "en": ["Indicator",  "Actual (%)",  "NPAN Target (%)",  "WHO Target (%)",  "NPAN Status", "WHO Status"],
}

NUTRITIONAL_TABLE_HEADERS = {
    "bm": ["Daerah", "N", "Stunting %", "Wasting %", "Kurus %", "Berat Lebih %"],
    "en": ["District", "N", "Stunting %", "Wasting %", "Underweight %", "Overweight %"],
}

AT_RISK_TABLE_HEADERS = {
    "bm": ["No. IC", "Daerah", "Skor Risiko", "Tahap", "Bendera Utama"],
    "en": ["IC No.",  "District", "Risk Score",  "Level", "Top Flags"],
}

# ---------------------------------------------------------------------------
# Trajectory status -> label (BM / EN)
# ---------------------------------------------------------------------------
TRAJECTORY_STATUS_LABELS: dict[str, dict[str, str]] = {
    "On Track":  {"bm": "Menuju Sasaran",       "en": "On Track"},
    "At Risk":   {"bm": "Berisiko",             "en": "At Risk"},
    "Off Track": {"bm": "Tidak Menuju Sasaran", "en": "Off Track"},
}


def trajectory_color(status: str) -> str:
    return {
        "On Track":  STATUS_ON_TRACK,
        "At Risk":   STATUS_AT_RISK,
        "Off Track": STATUS_OFF_TRACK,
    }.get(status, STATUS_NEUTRAL)


# ---------------------------------------------------------------------------
# Methodology lines (bilingual)
# ---------------------------------------------------------------------------
METHODOLOGY_LINES = [
    "Sumber Data / Data Sources: myVASS, CCMS, KPM, NCDC",
    "Piawaian Z-Score / Z-Score Standard: WHO 2006 Child Growth Standards (WHO_Anthro v3.2.2)",
    "Klasifikasi / Classification: WAZ<-2 SD=Kurus; HAZ<-2 SD=Stunted; WHZ<-2 SD=Wasted",
    "Peraturan Kualiti / Quality Rules: KKM-defined completeness, consistency & range checks",
    "Pengesanan Anomali / Anomaly Detection: IsolationForest (contamination=0.05) + 3xIQR fence",
    "Pengkelasan Corak / Pattern Classification: Decimal shift, digit transposition, column swap",
    "Pemarkahan Risiko / Risk Scoring: Weighted flag-sum (Stunting x25, Wasting x30, Underweight x20)",
    "Penanda Aras / Benchmarks: NPAN 2021-2025 national targets; WHO Global Targets 2025",
    "Analisis Trend / Trend Analysis: Ordinary least-squares linear regression (>=3 periods)",
    "Trajektori / Trajectory: Forecasts 4 periods ahead; On Track if forecast <= NPAN target",
]
