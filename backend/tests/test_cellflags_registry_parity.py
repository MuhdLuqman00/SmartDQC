"""Guard against silent drift between the backend clinical-ranges registry and
the frontend fallback constants.

frontend/src/utils/cellFlags.ts defines DEFAULT_CELL_THRESHOLDS — the values the
Explorer falls back to when GET /config/clinical-ranges is unreachable. They are
hand-copied from the registry defaults, so a registry change could silently leave
the frontend fallback stale.

This test parses the real cellFlags.ts and asserts every fallback value still
equals its registry default. If it fails, update DEFAULT_CELL_THRESHOLDS in
frontend/src/utils/cellFlags.ts to match the new registry value (or vice versa).
"""
import re
from pathlib import Path

import pytest

from backend.clinical_ranges import RANGES

_CELLFLAGS = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "utils" / "cellFlags.ts"
)

# frontend constant name → (registry key, field)
_MAPPING = {
    "beratImpossibleLow":   ("br02_weight_impossible", "min"),
    "beratImpossibleHigh":  ("br02_weight_impossible", "max"),
    "beratClinicalLow":     ("school_weight", "min"),
    "beratClinicalHigh":    ("school_weight", "max"),
    "tinggiImpossibleLow":  ("br03_height_impossible", "min"),
    "tinggiImpossibleHigh": ("br03_height_impossible", "max"),
    "tinggiClinicalLow":    ("school_height", "min"),
    "tinggiClinicalHigh":   ("school_height", "max"),
    "bmiUnderweight":       ("bmi_underweight", "value"),
    "bmiObese":             ("bmi_obese", "value"),
}


def _parse_default_cell_thresholds() -> dict[str, float]:
    if not _CELLFLAGS.exists():  # pragma: no cover - layout guard
        pytest.skip(f"cellFlags.ts not found at {_CELLFLAGS}")
    text = _CELLFLAGS.read_text(encoding="utf-8")
    block = re.search(
        r"DEFAULT_CELL_THRESHOLDS\s*:\s*ClinicalThresholds\s*=\s*\{(.*?)\}",
        text, re.DOTALL,
    )
    assert block, "DEFAULT_CELL_THRESHOLDS block not found in cellFlags.ts"
    pairs = re.findall(r"(\w+)\s*:\s*([0-9]+(?:\.[0-9]+)?)", block.group(1))
    return {name: float(val) for name, val in pairs}


def test_frontend_fallback_matches_registry_defaults():
    parsed = _parse_default_cell_thresholds()
    missing = set(_MAPPING) - set(parsed)
    assert not missing, f"cellFlags.ts missing expected keys: {sorted(missing)}"

    for fe_name, (reg_key, field) in _MAPPING.items():
        expected = float(RANGES[reg_key][field])
        actual = parsed[fe_name]
        assert actual == expected, (
            f"Drift: cellFlags.ts DEFAULT_CELL_THRESHOLDS.{fe_name}={actual} but "
            f"registry {reg_key}.{field}={expected}. Update the frontend fallback "
            f"in frontend/src/utils/cellFlags.ts."
        )
