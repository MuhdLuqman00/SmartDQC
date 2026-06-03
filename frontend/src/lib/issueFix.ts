/* Bilingual "suggested fix" hints for data-quality issues, keyed by the same
 * stable `code` the backend emits (see issueCatalog.ts). The Quality Check
 * step renders these inside an issue's expandable panel so a reviewer sees
 * what cleaning will do and what they can act on — not just the count.
 *
 * Honest scope: the pre-clean quality-check only emits `col_empty` today; the
 * other codes mirror the cleaning-rule vocabulary so the same panel stays
 * useful if those surface here later. An unmapped code returns null and the
 * UI simply omits the fix line (never a blank label). */

import type { IssueLike } from './issueCatalog';

const FIXES: Record<string, { en: string; bm: string }> = {
  col_empty: {
    en: 'Rows missing a critical field (IC, date, height, weight) are dropped during cleaning; the rest are flagged. Re-check the source export or this column’s mapping if it should always be filled.',
    bm: 'Baris yang kehilangan medan kritikal (IC, tarikh, tinggi, berat) dibuang semasa pembersihan; selebihnya ditanda. Semak semula eksport sumber atau pemetaan lajur ini jika ia sepatutnya sentiasa diisi.',
  },
  duplicate_ic: {
    en: 'Exact duplicate records (same IC and measurement date) are removed automatically during cleaning. Review the source if duplicates are unexpected.',
    bm: 'Rekod duplikat tepat (IC dan tarikh pengukuran sama) dibuang secara automatik semasa pembersihan. Semak sumber jika duplikat tidak dijangka.',
  },
  bad_dates: {
    en: 'Invalid or impossible dates are removed during cleaning. Check the date formatting in the source export.',
    bm: 'Tarikh tidak sah atau mustahil dibuang semasa pembersihan. Semak format tarikh dalam eksport sumber.',
  },
  invalid_age: {
    en: 'Records outside the valid age window (0–60 months) are removed. Verify the birth and measurement dates in the source.',
    bm: 'Rekod di luar julat umur sah (0–60 bulan) dibuang. Sahkan tarikh lahir dan tarikh pengukuran dalam sumber.',
  },
  unknown_gender: {
    en: 'Ambiguous gender values are normalised to L/P where possible, otherwise flagged for review.',
    bm: 'Nilai jantina meragukan dinormalkan kepada L/P jika boleh, jika tidak ia ditanda untuk semakan.',
  },
};

/** Suggested-fix hint for an issue, by `code`. Returns null when there is no
 *  mapped hint so the caller can omit the line entirely. */
export function suggestFix(issue: IssueLike, lang: 'en' | 'bm'): string | null {
  const entry = issue.code ? FIXES[issue.code] : undefined;
  if (!entry) return null;
  return lang === 'en' ? entry.en : entry.bm;
}
