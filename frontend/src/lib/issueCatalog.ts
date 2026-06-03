/* Bilingual catalog for backend-generated data-quality issue / cleaning-rule
 * strings.
 *
 * The backend emits each issue with a stable `code` (the raw stat key, e.g.
 * "dropped_duplicate_ic") plus an English `description`. We translate by
 * `code` here so the strings follow the BM/EN toggle in BOTH directions, and
 * fall back to the English `description` for any code not yet mapped — an
 * unknown key degrades to English, never to a blank.
 *
 * Numeric counts are rendered separately by the UI, so the phrasings here are
 * count-free noun phrases. Only `col_empty` interpolates ({field}, {pct}). */

export interface IssueLike {
  code?: string | null;
  description?: string | null;
  count?: number;
  field?: string | null;
  pct?: number | null;
}

const CATALOG: Record<string, { en: string; bm: string }> = {
  // Step 3 — per-column completeness (parametrised).
  col_empty: { en: "Column '{field}' is {pct}% empty", bm: "Lajur '{field}' {pct}% kosong" },

  // Gender
  dropped_invalid_gender: { en: 'Invalid gender values removed', bm: 'Nilai jantina tidak sah dibuang' },
  dropped_ragu_gender:    { en: 'Ambiguous gender values removed', bm: 'Nilai jantina meragukan dibuang' },
  ragu_gender:            { en: 'Ambiguous gender values flagged', bm: 'Nilai jantina meragukan ditanda' },
  unknown_gender:         { en: 'Unknown gender values', bm: 'Nilai jantina tidak diketahui' },

  // Dates / age
  dropped_date_before_dob: { en: 'Measurements dated before birth removed', bm: 'Pengukuran bertarikh sebelum lahir dibuang' },
  dropped_null_dob:        { en: 'Records missing date of birth removed', bm: 'Rekod tanpa tarikh lahir dibuang' },
  null_tarikh_lahir:       { en: 'Records missing date of birth', bm: 'Rekod tanpa tarikh lahir' },
  bad_dates:               { en: 'Invalid dates', bm: 'Tarikh tidak sah' },
  dropped_invalid_date:    { en: 'Invalid dates removed', bm: 'Tarikh tidak sah dibuang' },
  invalid_age:             { en: 'Invalid age records', bm: 'Rekod umur tidak sah' },
  dropped_age_invalid:     { en: 'Invalid age records removed', bm: 'Rekod umur tidak sah dibuang' },

  // Measurements
  dropped_measurement_outlier: { en: 'Measurement outliers removed', bm: 'Pencilan pengukuran dibuang' },
  dropped_bmi_outlier:         { en: 'BMI outliers removed', bm: 'Pencilan BMI dibuang' },
  dropped_no_measurement:      { en: 'Records with no measurement removed', bm: 'Rekod tanpa pengukuran dibuang' },
  dropped_no_bmi:              { en: 'Records with no BMI removed', bm: 'Rekod tanpa BMI dibuang' },
  dropped_null_zscore:         { en: 'Records missing z-scores removed', bm: 'Rekod tanpa z-skor dibuang' },
  null_berat_original:         { en: 'Missing weight values', bm: 'Nilai berat hilang' },
  null_tinggi_original:        { en: 'Missing height values', bm: 'Nilai tinggi hilang' },
  berat_out_of_range:          { en: 'Weight out of valid range', bm: 'Berat di luar julat sah' },
  tinggi_out_of_range:         { en: 'Height out of valid range', bm: 'Tinggi di luar julat sah' },

  // Duplicates / identity
  dropped_duplicate_ic:    { en: 'Duplicate IC records removed', bm: 'Rekod IC berganda dibuang' },
  duplicate_ic:            { en: 'Duplicate IC records', bm: 'Rekod IC berganda' },
  dropped_duplicate_id:    { en: 'Duplicate student ID records removed', bm: 'Rekod ID murid berganda dibuang' },
  dropped_duplicate_mykid: { en: 'Duplicate MyKid records removed', bm: 'Rekod MyKid berganda dibuang' },

  // Cohort / income
  dropped_non_tahun_satu: { en: 'Non Year-One records removed', bm: 'Rekod bukan Tahun Satu dibuang' },
  dropped_pendapatan_x:   { en: 'Records with invalid income removed', bm: 'Rekod pendapatan tidak sah dibuang' },

  // Review
  flagged_records: { en: 'Records flagged for review', bm: 'Rekod ditanda untuk semakan' },
};

function interpolate(template: string, issue: IssueLike): string {
  return template
    .replace('{field}', String(issue.field ?? ''))
    .replace('{pct}', String(issue.pct ?? ''));
}

/** Localise a backend issue/rule by its `code`, falling back to the English
 *  `description` (then an empty string) when the code is unmapped. */
export function translateIssue(issue: IssueLike, lang: 'en' | 'bm'): string {
  const entry = issue.code ? CATALOG[issue.code] : undefined;
  if (entry) return interpolate(lang === 'en' ? entry.en : entry.bm, issue);
  return issue.description ?? '';
}
