// Thresholds sourced verbatim from backend/cleaning/kkm.py constants
// and backend/eda/kkm_quality_rules.py BR-02/BR-03.
// Do NOT change these values without updating the backend constants.

import type React from 'react';

export type CellFlag = 'danger' | 'warn' | 'ok';

// Weight (kg) — 7-year-old KKM cohort
const BERAT_IMPOSSIBLE_LOW  = 10.0;   // BR-02 biologically impossible
const BERAT_IMPOSSIBLE_HIGH = 125.0;  // BR-02 biologically impossible
const BERAT_CLINICAL_LOW    = 12.0;   // kkm.py BERAT_MIN
const BERAT_CLINICAL_HIGH   = 50.0;   // kkm.py BERAT_MAX

// Height (cm) — 7-year-old KKM cohort
const TINGGI_IMPOSSIBLE_LOW  = 50.0;  // BR-03 biologically impossible
const TINGGI_IMPOSSIBLE_HIGH = 200.0; // BR-03 biologically impossible
const TINGGI_CLINICAL_LOW    = 100.0; // kkm.py TINGGI_MIN
const TINGGI_CLINICAL_HIGH   = 160.0; // kkm.py TINGGI_MAX

// BMI — WHO 2007 reference for 7-year-olds (kkm.py)
const BMI_UNDERWEIGHT = 13.5;
const BMI_OBESE       = 18.5;

// Suspicious date bounds (kkm_quality_rules.py BR-09)
const DATE_EARLIEST_MS = new Date('2008-01-01').getTime();
const DATE_LATEST_MS   = new Date('2026-12-31').getTime();

function isMissing(v: unknown): boolean {
  return v == null || v === '' || v === 'null' || v === 'None' || v === 'nan';
}

function isBeratCol(col: string): boolean {
  const c = col.toLowerCase();
  return c.includes('berat') && c.includes('kg');
}

function isTinggiCol(col: string): boolean {
  const c = col.toLowerCase();
  return c.includes('tinggi') && c.includes('cm');
}

function isBmiCol(col: string): boolean {
  return col.toLowerCase().includes('bmi');
}

function isDateCol(col: string): boolean {
  return col.toLowerCase().includes('tarikh');
}

/**
 * Classify a cell value as 'danger' (biologically impossible / clearly wrong),
 * 'warn' (out of clinical range, missing, or suspicious), or 'ok'.
 * Used for conditional formatting (Phase 2) and pre-save validation (Phase 3).
 */
export function classifyCell(col: string, value: unknown): CellFlag {
  if (isMissing(value)) return 'warn';

  if (isBeratCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < BERAT_IMPOSSIBLE_LOW || n > BERAT_IMPOSSIBLE_HIGH) return 'danger';
    if (n < BERAT_CLINICAL_LOW   || n > BERAT_CLINICAL_HIGH)   return 'warn';
    return 'ok';
  }

  if (isTinggiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < TINGGI_IMPOSSIBLE_LOW || n > TINGGI_IMPOSSIBLE_HIGH) return 'danger';
    if (n < TINGGI_CLINICAL_LOW   || n > TINGGI_CLINICAL_HIGH)   return 'warn';
    return 'ok';
  }

  if (isBmiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < BMI_UNDERWEIGHT || n > BMI_OBESE) return 'warn';
    return 'ok';
  }

  if (isDateCol(col)) {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return 'warn';
    if (d.getTime() < DATE_EARLIEST_MS || d.getTime() > DATE_LATEST_MS) return 'warn';
    return 'ok';
  }

  return 'ok';
}

/** Returns style overrides for a flagged cell. Spread onto the <td> style prop. */
export function cellFlagStyle(flag: CellFlag): React.CSSProperties {
  if (flag === 'danger') return {
    background:  'var(--danger-bg)',
    borderLeft:  '3px solid var(--danger)',
    paddingLeft: 11,
  };
  if (flag === 'warn') return {
    background:  'var(--warning-bg)',
    borderLeft:  '3px solid var(--warning)',
    paddingLeft: 11,
  };
  return {};
}
