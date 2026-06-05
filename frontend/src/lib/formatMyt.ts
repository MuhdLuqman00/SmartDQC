/* ── Malaysia-time (MYT, UTC+8) timestamp formatting ──────────────────────
   The backend serialises naive `datetime.utcnow()` via `.isoformat()`, which
   yields a string with NO timezone designator (e.g. "2026-06-04T07:30:00").
   `new Date("…")` then interprets that as the viewer's LOCAL time, so on a
   UTC+8 browser the value renders 8 hours behind the true Malaysia time.

   These helpers normalise by treating an offset-less string as UTC (append
   'Z') — but only when no zone is already present, so a value that already
   carries 'Z' or a ±HH:MM offset is never double-shifted — then format
   explicitly in Asia/Kuala_Lumpur so the result is correct regardless of the
   viewer's own timezone. Bilingual: BM uses the ms-MY locale, EN uses en-GB
   (day-month-year, 24-hour) to match Malaysian convention. */

const MYT = 'Asia/Kuala_Lumpur';

export type MytLang = 'en' | 'bm';

const localeFor = (lang: MytLang): string => (lang === 'bm' ? 'ms-MY' : 'en-GB');

/** Parse a backend timestamp into a Date, treating an offset-less value as
    UTC. Returns null for empty/unparseable input. */
function toUtcDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const s = iso.trim();
  if (!s) return null;
  // Detect an existing zone: trailing 'Z', or a ±HH:MM / ±HHMM offset.
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const d = new Date(hasTz ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date + time in MYT, e.g. "04 Jun 2026, 15:30". Falls back to "—". */
export function formatMytDateTime(iso: string | null | undefined, lang: MytLang = 'en'): string {
  const d = toUtcDate(iso);
  if (!d) return '—';
  return d.toLocaleString(localeFor(lang), {
    timeZone: MYT,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Date only in MYT, e.g. "04 Jun 2026". Falls back to "—". */
export function formatMytDate(iso: string | null | undefined, lang: MytLang = 'en'): string {
  const d = toUtcDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(localeFor(lang), {
    timeZone: MYT, day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Month + year in MYT, e.g. "June 2026" — used as the History group key.
    Falls back to a localised "Unknown" so undated rows still group. */
export function formatMytMonth(iso: string | null | undefined, lang: MytLang = 'en'): string {
  const d = toUtcDate(iso);
  if (!d) return lang === 'bm' ? 'Tidak diketahui' : 'Unknown';
  return d.toLocaleDateString(localeFor(lang), {
    timeZone: MYT, month: 'long', year: 'numeric',
  });
}
