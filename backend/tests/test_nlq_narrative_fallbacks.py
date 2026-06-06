"""Phase B: the AI layer must never emit a blank answer/narrative.

A blank answer is what made the frontend fall back to String(r.data) and
render '[object Object]'. These pin the source-side guarantees.
"""
import json
from unittest.mock import patch

from backend.ai.nlq import _ensure_answer
from backend.ai.narrative import _insights_fallback, raw_ok, generate_recommendations

# A real insights payload (no failure flags) so echo-guard tests reach the model call.
_GOOD_INSIGHTS = {
    "executive_summary": {"en": "Good data.", "bm": "Data baik."},
    "insights_5w1h": {},
    "explainability": {"flags": []},
}


def test_ensure_answer_fills_blank_bilingual_dict():
    out = _ensure_answer({"bm": "", "en": ""}, error=None)
    assert out["bm"] and out["en"]


def test_ensure_answer_uses_error_message_when_sandbox_failed():
    out = _ensure_answer(None, error="Traceback...\nImportError: nope")
    assert "ImportError: nope" in out["en"]
    assert out["bm"] and out["en"]


def test_ensure_answer_string_input_is_wrapped():
    out = _ensure_answer("just a string", error=None)
    assert out["bm"] == "just a string"
    assert out["en"] == "just a string"


def test_ensure_answer_one_sided_dict_is_mirrored():
    out = _ensure_answer({"en": "only english"}, error=None)
    assert out["bm"] == "only english"


def test_insights_fallback_is_flagged_and_non_blank():
    fb = _insights_fallback("msg en", "msg bm", "empty_response")
    assert fb["executive_summary"]["en"] == "msg en"
    assert "empty_response" in fb["explainability"]["flags"]
    assert raw_ok(fb) is False


def test_raw_ok_true_for_real_payload():
    assert raw_ok({"explainability": {"flags": []}}) is True
    assert raw_ok({}) is True


def test_recommendations_skipped_when_insights_failed():
    failed = _insights_fallback("x", "y", "parse_error")
    out = generate_recommendations({}, failed)
    assert out["recommendations"] == []
    assert out["_rec_flag"] == "skipped_insights_failed"


def test_echo_guard_drops_scaffolded_recs():
    """Model echoes the prompt scaffold verbatim → flagged as placeholder_echo."""
    echoed = json.dumps({"recommendations": [{
        "action_en": "short action title in English",
        "action_bm": "tajuk tindakan ringkas dalam Bahasa Malaysia",
        "priority": "high",
        "bm": "cadangan terperinci dalam Bahasa Malaysia",
        "en": "detailed recommendation in English",
        "reasoning": "why this is recommended based on the data",
    }]})
    with patch("backend.ai.narrative.generate", return_value=echoed):
        out = generate_recommendations({}, _GOOD_INSIGHTS)
    assert out["recommendations"] == []
    assert out.get("_rec_flag") == "placeholder_echo"


def test_echo_guard_passes_real_recs():
    """Model returns genuine content → recommendations pass through unchanged."""
    real = json.dumps({"recommendations": [{
        "action_en": "Increase clinic outreach in rural areas",
        "action_bm": "Tingkatkan jangkauan klinik di kawasan luar bandar",
        "priority": "high",
        "bm": "Cadangan terperinci dalam BM.",
        "en": "Detailed recommendation in English.",
        "reasoning": "Rural districts show 40% stunting above national average.",
    }]})
    with patch("backend.ai.narrative.generate", return_value=real):
        out = generate_recommendations({}, _GOOD_INSIGHTS)
    assert len(out["recommendations"]) == 1
    assert out["recommendations"][0]["action_en"] == "Increase clinic outreach in rural areas"
