// Phase 4: thresholds sourced from GET /config/clinical-ranges at runtime.
// Consumers fetch once on mount and pass a ClinicalThresholds object.
// DEFAULT_CELL_THRESHOLDS is the fallback (same values as the registry defaults).

import type React from 'react';

export type CellFlag = 'danger' | 'warn' | 'ok';

export interface ClinicalThresholds {
  beratImpossibleLow:   number;  // br02_weight_impossible min
  beratImpossibleHigh:  number;  // br02_weight_impossible max
  beratClinicalLow:     number;  // school_weight min
  beratClinicalHigh:    number;  // school_weight max
  tinggiImpossibleLow:  number;  // br03_height_impossible min
  tinggiImpossibleHigh: number;  // br03_height_impossible max
  tinggiClinicalLow:    number;  // school_height min
  tinggiClinicalHigh:   number;  // school_height max
  bmiUnderweight:       number;  // bmi_underweight value
  bmiObese:             number;  // bmi_obese value
}

export const DEFAULT_CELL_THRESHOLDS: ClinicalThresholds = {
  beratImpossibleLow:   10.0,
  beratImpossibleHigh:  125.0,
  beratClinicalLow:     12.0,
  beratClinicalHigh:    50.0,
  tinggiImpossibleLow:  50.0,
  tinggiImpossibleHigh: 200.0,
  tinggiClinicalLow:    100.0,
  tinggiClinicalHigh:   160.0,
  bmiUnderweight:       13.5,
  bmiObese:             18.5,
};

// Date bounds — BR-09 logic, not a registry-backed range threshold
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
 * Classify a cell value as 'danger', 'warn', or 'ok'.
 * Pass live thresholds fetched from GET /config/clinical-ranges for accuracy.
 */
export function classifyCell(
  col: string,
  value: unknown,
  thresholds: ClinicalThresholds = DEFAULT_CELL_THRESHOLDS,
): CellFlag {
  if (isMissing(value)) return 'warn';

  if (isBeratCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < thresholds.beratImpossibleLow || n > thresholds.beratImpossibleHigh) return 'danger';
    if (n < thresholds.beratClinicalLow   || n > thresholds.beratClinicalHigh)   return 'warn';
    return 'ok';
  }

  if (isTinggiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < thresholds.tinggiImpossibleLow || n > thresholds.tinggiImpossibleHigh) return 'danger';
    if (n < thresholds.tinggiClinicalLow   || n > thresholds.tinggiClinicalHigh)   return 'warn';
    return 'ok';
  }

  if (isBmiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'warn';
    if (n < thresholds.bmiUnderweight || n > thresholds.bmiObese) return 'warn';
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

export interface CellReason {
  flag: Exclude<CellFlag, 'ok'>;
  titleEN: string;
  titleBM: string;
  detailEN: string;
  detailBM: string;
}

/**
 * Explain why a cell is flagged — human-readable counterpart to classifyCell.
 * Returns null for 'ok' cells.
 */
export function describeCell(
  col: string,
  value: unknown,
  thresholds: ClinicalThresholds = DEFAULT_CELL_THRESHOLDS,
): CellReason | null {
  if (isMissing(value)) {
    return {
      flag: 'warn',
      titleEN: 'Missing value',     titleBM: 'Nilai tiada',
      detailEN: 'No value recorded for this field.',
      detailBM: 'Tiada nilai direkodkan untuk medan ini.',
    };
  }

  if (isBeratCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return {
      flag: 'warn', titleEN: 'Not a number', titleBM: 'Bukan nombor',
      detailEN: `"${String(value)}" is not a valid weight.`,
      detailBM: `"${String(value)}" bukan berat yang sah.`,
    };
    if (n < thresholds.beratImpossibleLow || n > thresholds.beratImpossibleHigh) return {
      flag: 'danger', titleEN: 'Impossible weight', titleBM: 'Berat mustahil',
      detailEN: `${n} kg is outside the possible range ${thresholds.beratImpossibleLow}–${thresholds.beratImpossibleHigh} kg.`,
      detailBM: `${n} kg di luar julat mungkin ${thresholds.beratImpossibleLow}–${thresholds.beratImpossibleHigh} kg.`,
    };
    if (n < thresholds.beratClinicalLow || n > thresholds.beratClinicalHigh) return {
      flag: 'warn',
      titleEN: n < thresholds.beratClinicalLow ? 'Below clinical range' : 'Above clinical range',
      titleBM: n < thresholds.beratClinicalLow ? 'Bawah julat klinikal' : 'Atas julat klinikal',
      detailEN: `${n} kg is outside the expected ${thresholds.beratClinicalLow}–${thresholds.beratClinicalHigh} kg for this cohort.`,
      detailBM: `${n} kg di luar jangkaan ${thresholds.beratClinicalLow}–${thresholds.beratClinicalHigh} kg untuk kohort ini.`,
    };
    return null;
  }

  if (isTinggiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return {
      flag: 'warn', titleEN: 'Not a number', titleBM: 'Bukan nombor',
      detailEN: `"${String(value)}" is not a valid height.`,
      detailBM: `"${String(value)}" bukan tinggi yang sah.`,
    };
    if (n < thresholds.tinggiImpossibleLow || n > thresholds.tinggiImpossibleHigh) return {
      flag: 'danger', titleEN: 'Impossible height', titleBM: 'Tinggi mustahil',
      detailEN: `${n} cm is outside the possible range ${thresholds.tinggiImpossibleLow}–${thresholds.tinggiImpossibleHigh} cm.`,
      detailBM: `${n} cm di luar julat mungkin ${thresholds.tinggiImpossibleLow}–${thresholds.tinggiImpossibleHigh} cm.`,
    };
    if (n < thresholds.tinggiClinicalLow || n > thresholds.tinggiClinicalHigh) return {
      flag: 'warn',
      titleEN: n < thresholds.tinggiClinicalLow ? 'Below clinical range' : 'Above clinical range',
      titleBM: n < thresholds.tinggiClinicalLow ? 'Bawah julat klinikal' : 'Atas julat klinikal',
      detailEN: `${n} cm is outside the expected ${thresholds.tinggiClinicalLow}–${thresholds.tinggiClinicalHigh} cm for this cohort.`,
      detailBM: `${n} cm di luar jangkaan ${thresholds.tinggiClinicalLow}–${thresholds.tinggiClinicalHigh} cm untuk kohort ini.`,
    };
    return null;
  }

  if (isBmiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return {
      flag: 'warn', titleEN: 'Not a number', titleBM: 'Bukan nombor',
      detailEN: `"${String(value)}" is not a valid BMI.`,
      detailBM: `"${String(value)}" bukan BMI yang sah.`,
    };
    if (n < thresholds.bmiUnderweight || n > thresholds.bmiObese) return {
      flag: 'warn',
      titleEN: n < thresholds.bmiUnderweight ? 'Underweight BMI' : 'Obese-range BMI',
      titleBM: n < thresholds.bmiUnderweight ? 'BMI kurang berat' : 'BMI lingkungan obes',
      detailEN: `BMI ${n} is outside the healthy ${thresholds.bmiUnderweight}–${thresholds.bmiObese} band (WHO 2007, age 7).`,
      detailBM: `BMI ${n} di luar julat sihat ${thresholds.bmiUnderweight}–${thresholds.bmiObese} (WHO 2007, umur 7).`,
    };
    return null;
  }

  if (isDateCol(col)) {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return {
      flag: 'warn', titleEN: 'Unreadable date', titleBM: 'Tarikh tidak terbaca',
      detailEN: `"${String(value)}" could not be parsed as a date.`,
      detailBM: `"${String(value)}" tidak dapat dibaca sebagai tarikh.`,
    };
    if (d.getTime() < DATE_EARLIEST_MS || d.getTime() > DATE_LATEST_MS) return {
      flag: 'warn', titleEN: 'Unusual date', titleBM: 'Tarikh luar biasa',
      detailEN: 'Date falls outside the expected 2008–2026 window.',
      detailBM: 'Tarikh di luar jangkaan 2008–2026.',
    };
    return null;
  }

  return null;
}

/** Client-side guardrail before persisting an edit. Backend still coerces on receipt. */
export function validateEdit(
  col: string,
  value: string,
  thresholds: ClinicalThresholds = DEFAULT_CELL_THRESHOLDS,
): { ok: boolean; messageEN: string; messageBM: string } {
  const ok = { ok: true, messageEN: '', messageBM: '' };

  if (value.trim() === '') return ok;

  if (isBeratCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, messageEN: 'Weight must be a number.', messageBM: 'Berat mestilah nombor.' };
    if (n < thresholds.beratImpossibleLow || n > thresholds.beratImpossibleHigh) return {
      ok: false,
      messageEN: `Weight must be between ${thresholds.beratImpossibleLow}–${thresholds.beratImpossibleHigh} kg.`,
      messageBM: `Berat mestilah antara ${thresholds.beratImpossibleLow}–${thresholds.beratImpossibleHigh} kg.`,
    };
    return ok;
  }

  if (isTinggiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, messageEN: 'Height must be a number.', messageBM: 'Tinggi mestilah nombor.' };
    if (n < thresholds.tinggiImpossibleLow || n > thresholds.tinggiImpossibleHigh) return {
      ok: false,
      messageEN: `Height must be between ${thresholds.tinggiImpossibleLow}–${thresholds.tinggiImpossibleHigh} cm.`,
      messageBM: `Tinggi mestilah antara ${thresholds.tinggiImpossibleLow}–${thresholds.tinggiImpossibleHigh} cm.`,
    };
    return ok;
  }

  if (isBmiCol(col)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, messageEN: 'BMI must be a number.', messageBM: 'BMI mestilah nombor.' };
    return ok;
  }

  return ok;
}

/** Returns style overrides for a flagged cell. Spread onto the <td> style prop. */
export function cellFlagStyle(flag: CellFlag): React.CSSProperties {
  if (flag === 'danger') return { background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger)', paddingLeft: 11 };
  if (flag === 'warn')   return { background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', paddingLeft: 11 };
  return {};
}
