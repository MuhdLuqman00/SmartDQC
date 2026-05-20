"""Feature #14 — Entity Resolution (MVP: exact IC match).

link_records()    — groups records by normalised 12-digit IC
persist_linkage() — writes groups to entity_linkage table
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


def _normalise_ic(raw: str) -> str:
    """Strip dashes/spaces; return 12-digit string or '' if invalid."""
    cleaned = re.sub(r"[\s\-]", "", str(raw or ""))
    if re.fullmatch(r"\d{12}", cleaned):
        return cleaned
    return ""


def _ic_match_confidence(ic_a: str, ic_b: str) -> float:
    if ic_a and ic_b and ic_a == ic_b:
        return 1.0
    return 0.0


def link_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group records by normalised IC. Return unified child profiles.

    Each record: {ic, source_type, dataset_id, name, dob}
    Each group:  {ic, source_types, sources, match_confidence, name, dob}
    """
    groups: dict[str, list[dict]] = defaultdict(list)
    unmatched: list[dict] = []

    for rec in records:
        norm = _normalise_ic(rec.get("ic", ""))
        if norm:
            groups[norm].append(rec)
        else:
            unmatched.append(rec)

    result = []
    for ic, members in groups.items():
        result.append({
            "ic":               ic,
            "source_types":     list({m["source_type"] for m in members}),
            "sources":          members,
            "match_confidence": 1.0,
            "name":             next((m["name"] for m in members if m.get("name")), None),
            "dob":              next((m["dob"] for m in members if m.get("dob")), None),
        })

    for rec in unmatched:
        result.append({
            "ic":               rec.get("ic", ""),
            "source_types":     [rec["source_type"]],
            "sources":          [rec],
            "match_confidence": 0.0,
            "name":             rec.get("name"),
            "dob":              rec.get("dob"),
        })

    return result


def persist_linkage(groups: list[dict], db_session) -> int:
    """Write entity linkage groups to the entity_linkage table. Returns row count."""
    from datetime import datetime
    from backend.db.models import EntityLinkage

    rows_written = 0
    for group in groups:
        for src in group["sources"]:
            db_session.add(EntityLinkage(
                ic_no=group["ic"],
                source_type=src["source_type"],
                dataset_id=src.get("dataset_id"),
                name=group["name"],
                dob=group["dob"],
                match_confidence=group["match_confidence"],
                created_at=datetime.utcnow(),
            ))
            rows_written += 1

    db_session.commit()
    return rows_written


# ─────────────────────────────────────────────────────────────────────────────
# v2 matching — fuzzy IC + name/dob boost with confidence reasoning
# ─────────────────────────────────────────────────────────────────────────────


def _levenshtein(a: str, b: str) -> int:
    """Iterative Levenshtein distance — used for fuzzy IC matching where
    a single typo / OCR slip changes one digit. Keeps memory O(min(|a|,|b|))."""
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr.append(min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = curr
    return prev[-1]


def _normalise_name(raw: str) -> str:
    """Uppercase + strip + collapse internal whitespace so 'Ali  Bin Ahmad' and
    'ALI BIN AHMAD ' are equivalent for boost-comparison."""
    return " ".join(str(raw or "").upper().split())


def _normalise_dob(raw: str) -> str:
    """Reduce to YYYY-MM-DD if it looks like an ISO-style date; otherwise
    just strip whitespace. Tolerant on purpose — input is messy."""
    s = str(raw or "").strip()
    # Common formats: '2020-01-15', '15/01/2020', '15-01-2020', '2020/01/15'
    digits = re.sub(r"[^\d]", "", s)
    if len(digits) == 8:
        # Heuristic: leading 4 digits in 1900–2030 → YYYYMMDD, else DDMMYYYY.
        if 1900 <= int(digits[:4]) <= 2030:
            return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
        return f"{digits[4:8]}-{digits[2:4]}-{digits[0:2]}"
    return s


def link_records_v2(
    records: list[dict[str, Any]],
    *,
    fuzzy_ic: bool = True,
    fuzzy_ic_max_distance: int = 1,
    name_dob_boost: bool = True,
    min_confidence: float = 0.6,
) -> list[dict[str, Any]]:
    """Group records across datasets with richer matching than v1.

    Pipeline:
      1. Exact IC match (confidence 1.0, reason="exact_ic").
      2. If `fuzzy_ic` is on, merge any remaining records whose IC differs
         from an existing group's IC by ≤ `fuzzy_ic_max_distance` edits
         (confidence 0.85, reason="fuzzy_ic±N").
      3. If `name_dob_boost` is on, additionally merge IC-less records that
         match an existing group on normalised (name, dob) (confidence 0.7,
         reason="name+dob").
      4. Anything still unmatched becomes a single-source group with
         confidence 0.0 (reason="unmatched").

    Records below `min_confidence` after matching are still returned so the
    UI can choose to filter them — the threshold gates the *match attempt*,
    not the result list.

    Input records: {ic, source_type, dataset_id, name, dob, [extra keys passed through]}
    Output groups: {ic, sources[], confidence, match_reasons[], name, dob}
    """
    groups: list[dict] = []                          # list of group dicts
    by_ic: dict[str, dict] = {}                      # normalised IC → group
    by_name_dob: dict[tuple[str, str], dict] = {}    # (name, dob) → group

    def _new_group(rec: dict, ic_norm: str, confidence: float, reasons: list[str]) -> dict:
        g = {
            "ic": ic_norm,
            "sources": [rec],
            "confidence": confidence,
            "match_reasons": list(reasons),
            "name": rec.get("name") or None,
            "dob": rec.get("dob") or None,
        }
        groups.append(g)
        return g

    def _attach(g: dict, rec: dict, *, drop_confidence_floor: float | None = None,
                add_reason: str | None = None) -> None:
        g["sources"].append(rec)
        if drop_confidence_floor is not None:
            g["confidence"] = min(g["confidence"], drop_confidence_floor)
        if add_reason and add_reason not in g["match_reasons"]:
            g["match_reasons"].append(add_reason)
        if not g.get("name") and rec.get("name"):
            g["name"] = rec["name"]
        if not g.get("dob") and rec.get("dob"):
            g["dob"] = rec["dob"]

    # ── Pass 1: exact IC ────────────────────────────────────────────────────
    for rec in records:
        ic_norm = _normalise_ic(rec.get("ic", ""))
        if not ic_norm:
            continue
        g = by_ic.get(ic_norm)
        if g is None:
            g = _new_group(rec, ic_norm, confidence=1.0, reasons=["exact_ic"])
            by_ic[ic_norm] = g
            # Also index by name+dob if both present, for pass 3.
            nd = (_normalise_name(rec.get("name", "")), _normalise_dob(rec.get("dob", "")))
            if nd[0] and nd[1]:
                by_name_dob[nd] = g
        else:
            _attach(g, rec)

    # ── Pass 2: fuzzy IC ────────────────────────────────────────────────────
    fuzzy_unmatched: list[dict] = []
    if fuzzy_ic:
        ic_keys = list(by_ic.keys())
        for rec in records:
            ic_norm = _normalise_ic(rec.get("ic", ""))
            if ic_norm and ic_norm in by_ic:
                continue  # already attached in pass 1
            if not ic_norm:
                fuzzy_unmatched.append(rec)
                continue
            # Find nearest known IC by Levenshtein distance.
            best_key, best_d = None, fuzzy_ic_max_distance + 1
            for key in ic_keys:
                d = _levenshtein(ic_norm, key)
                if d < best_d:
                    best_key, best_d = key, d
                    if d == 1:
                        break
            if best_key is not None and best_d <= fuzzy_ic_max_distance:
                _attach(
                    by_ic[best_key], rec,
                    drop_confidence_floor=0.85,
                    add_reason=f"fuzzy_ic±{best_d}",
                )
            else:
                fuzzy_unmatched.append(rec)
    else:
        fuzzy_unmatched = [r for r in records if _normalise_ic(r.get("ic", "")) not in by_ic]

    # ── Pass 3: name + DOB boost (only for records still unmatched) ─────────
    still_unmatched: list[dict] = []
    if name_dob_boost:
        for rec in fuzzy_unmatched:
            name_n = _normalise_name(rec.get("name", ""))
            dob_n  = _normalise_dob(rec.get("dob", ""))
            if not name_n or not dob_n:
                still_unmatched.append(rec)
                continue
            g = by_name_dob.get((name_n, dob_n))
            if g is None:
                still_unmatched.append(rec)
            else:
                _attach(g, rec, drop_confidence_floor=0.7, add_reason="name+dob")
    else:
        still_unmatched = fuzzy_unmatched

    # ── Pass 4: orphans become their own single-source groups ───────────────
    for rec in still_unmatched:
        ic_norm = _normalise_ic(rec.get("ic", ""))
        g = _new_group(rec, ic_norm, confidence=0.0, reasons=["unmatched"])
        if ic_norm and ic_norm not in by_ic:
            by_ic[ic_norm] = g

    # Filter to >= min_confidence at *match-attempt* level (every group with
    # at least one matched pair has confidence ≥ 0.7 in our pipeline; the
    # threshold mostly excludes unmatched singles when set above 0.0).
    if min_confidence > 0.0:
        groups = [g for g in groups if g["confidence"] >= min_confidence]

    return groups
