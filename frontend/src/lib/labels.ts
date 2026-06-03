/* Shared demographic-label localisation.
 *
 * The backend returns data-driven gender values and BM-hardcoded age buckets
 * (e.g. "Lelaki", "Bawah 2 Tahun"). Normalise then translate so breakdown
 * labels follow the chosen UI language in BOTH directions. Used by the
 * Dashboard and Geo & Risk breakdown lists so they stay in lock-step.
 *
 * Group keys other than gender/age (state, daerah, income raw values) are
 * proper nouns / source labels and pass through unchanged. */

export type GroupLabelKey = 'gender' | 'group' | 'income';

export function formatGroupLabel(labelKey: GroupLabelKey, raw: string, lang: 'en' | 'bm'): string {
  const v = raw.trim().toLowerCase();
  if (labelKey === 'gender') {
    if (['lelaki', 'l', 'male', 'm'].includes(v)) return lang === 'en' ? 'Male' : 'Lelaki';
    if (['perempuan', 'p', 'female', 'f'].includes(v)) return lang === 'en' ? 'Female' : 'Perempuan';
    return raw;
  }
  if (v === 'bawah 2 tahun') return lang === 'en' ? 'Under 2 Years' : 'Bawah 2 Tahun';
  if (v === '2-5 tahun' || v === '2–5 tahun') return lang === 'en' ? '2–5 Years' : '2-5 Tahun';
  return raw;
}
