import json
import re
from .ollama_client import generate, OllamaError

INSIGHTS_SYSTEM = """You are SmartDQC, a bilingual (Bahasa Malaysia and English) data quality analyst for KKM (Kementerian Kesihatan Malaysia).
You analyse child nutrition and health data and produce structured JSON insights.
Always respond with valid JSON only. No markdown, no explanation outside the JSON."""

RECOMMENDATIONS_SYSTEM = """You are SmartDQC, a bilingual (Bahasa Malaysia and English) public health advisor for KKM.
You produce actionable recommendations based on data insights.
Always respond with valid JSON only. No markdown, no explanation outside the JSON."""


def build_context(eda_result: dict) -> str:
    parts = []

    summary = eda_result.get("summary", {})
    if summary:
        parts.append(f"Dataset: {summary.get('total_rows', 'N/A')} records, source: {summary.get('source_type', 'unknown')}")

    quality = eda_result.get("quality", {})
    if quality:
        score = quality.get("overall_score", quality.get("score", "N/A"))
        parts.append(f"Overall quality score: {score}")
        missing = quality.get("missing_rate", quality.get("missing_pct", "N/A"))
        parts.append(f"Missing data rate: {missing}")

    indicators = eda_result.get("indicators", {})
    if indicators:
        for k, v in list(indicators.items())[:10]:
            parts.append(f"{k}: {v}")

    outliers = eda_result.get("outliers", {})
    if outliers:
        total = outliers.get("total_flagged", outliers.get("count", "N/A"))
        parts.append(f"Outliers flagged: {total}")

    negeri = eda_result.get("by_negeri", eda_result.get("negeri_breakdown", {}))
    if negeri:
        top = list(negeri.items())[:5]
        parts.append("By state (top 5): " + ", ".join(f"{k}={v}" for k, v in top))

    return "\n".join(parts) if parts else "No structured context available."


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(raw)


_EMPTY_KEYS = ["who", "what", "when", "where", "why", "how"]


def _insights_fallback(message_en: str, message_bm: str, flag: str) -> dict:
    """A clearly-flagged, non-blank insights payload.

    A silent empty narrative renders as 'No narrative produced.' with no
    explanation; this surfaces a visible reason + an explainability flag so
    the user knows to retry rather than seeing a blank panel.
    """
    return {
        "executive_summary": {"bm": message_bm, "en": message_en},
        "insights_5w1h": {d: {"bm": "", "en": ""} for d in _EMPTY_KEYS},
        "explainability": {"flags": [flag]},
    }


def generate_insights(eda_result: dict) -> dict:
    context = build_context(eda_result)
    prompt = f"""Based on this KKM health dataset analysis, produce a JSON response with executive summary and 5W1H insights.

Dataset context:
{context}

Respond with this exact JSON structure:
{{
  "executive_summary": {{"bm": "...", "en": "..."}},
  "insights_5w1h": {{
    "who":   {{"bm": "...", "en": "..."}},
    "what":  {{"bm": "...", "en": "..."}},
    "when":  {{"bm": "...", "en": "..."}},
    "where": {{"bm": "...", "en": "..."}},
    "why":   {{"bm": "...", "en": "..."}},
    "how":   {{"bm": "...", "en": "..."}}
  }},
  "explainability": {{
    "flags": []
  }}
}}"""

    raw = generate(prompt, system=INSIGHTS_SYSTEM, json_mode=True)
    if not raw or not raw.strip():
        return _insights_fallback(
            "AI insight generation returned no output — the model may be "
            "loading or offline. Please retry in a moment.",
            "Penjanaan wawasan AI tidak menghasilkan output — model mungkin "
            "sedang dimuatkan atau luar talian. Sila cuba semula sebentar lagi.",
            "empty_response",
        )
    try:
        return _extract_json(raw)
    except Exception:
        return _insights_fallback(
            "AI insight could not be parsed (model returned non-JSON output). "
            "Please retry.",
            "Wawasan AI tidak dapat dihuraikan (model memberi output bukan JSON). "
            "Sila cuba semula.",
            "parse_error",
        )


def raw_ok(insights: dict) -> bool:
    """True if insights is a real model result (not a flagged fallback)."""
    flags = (insights.get("explainability") or {}).get("flags") or []
    return not any(f in ("empty_response", "parse_error") for f in flags)


def generate_recommendations(eda_result: dict, insights: dict) -> dict:
    context = build_context(eda_result)
    summary_bm = insights.get("executive_summary", {}).get("bm", "")

    prompt = f"""Based on this KKM dataset analysis and insights, produce actionable recommendations in JSON.

Dataset context:
{context}

Key insight: {summary_bm}

Respond with this exact JSON structure:
{{
  "recommendations": [
    {{
      "action": "short action title",
      "priority": "high",
      "bm": "detailed recommendation in Bahasa Malaysia",
      "en": "detailed recommendation in English",
      "reasoning": "why this is recommended based on the data"
    }}
  ]
}}

Provide 3-5 recommendations ordered by priority (high/medium/low)."""

    if not raw_ok(insights):
        # Insights failed; don't waste a second model call or imply success.
        return {"recommendations": [], "_rec_flag": "skipped_insights_failed"}

    raw = generate(prompt, system=RECOMMENDATIONS_SYSTEM, json_mode=True)
    if not raw or not raw.strip():
        return {"recommendations": [], "_rec_flag": "empty_response"}
    try:
        return _extract_json(raw)
    except Exception:
        return {"recommendations": [], "_rec_flag": "parse_error"}


def generate_narrative(eda_result: dict) -> dict:
    insights = generate_insights(eda_result)
    recommendations = generate_recommendations(eda_result, insights)
    return {**insights, **recommendations}
