/* Range-aware compact number formatting for crowded chart axes.
 *
 * Chart x-axes in SmartDQC span wildly different magnitudes — huge IC numbers
 * (≈9.1e11), record counts, and small z-scores (−2.5). A single compact
 * formatter keeps tick labels short without mangling the small decimals, while
 * the full-precision value stays in the tooltip. */

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 1_000_000_000) return trim(n / 1_000_000_000) + 'B';
  if (abs >= 1_000_000)     return trim(n / 1_000_000) + 'M';
  if (abs >= 10_000)        return Math.round(n / 1_000) + 'k';
  if (abs >= 1_000)         return trim(n / 1_000) + 'k';
  if (abs >= 100)           return String(Math.round(n));
  if (abs >= 10)            return n.toFixed(1).replace(/\.0$/, '');
  // small values (z-scores etc.) — keep one decimal of resolution
  return n.toFixed(1).replace(/\.0$/, '');
}

/** One decimal, dropping a trailing ".0". */
function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** Compact a "a–b" bucket-range label (en-dash or spaced hyphen separated),
 *  compacting each numeric end. No-ops on any label it can't parse, so it's
 *  safe regardless of the backend's separator. */
export function formatRange(s: string): string {
  if (typeof s !== 'string') return String(s);
  const sep = s.includes('–') ? '–' : s.includes(' - ') ? ' - ' : null;
  if (!sep) return s;
  const [a, b] = s.split(sep);
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return `${formatCompact(na)}–${formatCompact(nb)}`;
  }
  return s;
}
