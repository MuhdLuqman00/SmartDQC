"""Phase B: the AI layer must never emit a blank answer/narrative.

A blank answer is what made the frontend fall back to String(r.data) and
render '[object Object]'. These pin the source-side guarantees.
"""
from backend.ai.nlq import _ensure_answer
from backend.ai.narrative import _insights_fallback, raw_ok, generate_recommendations


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
