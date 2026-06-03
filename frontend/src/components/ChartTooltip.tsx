import React from 'react';

/* Themed Recharts tooltip that reads from surface tokens so it works in
   both light and dark mode. Drop in via:
       <Tooltip content={<ChartTooltip />} />
   or with a value formatter:
       <Tooltip content={<ChartTooltip valueFormatter={v => `${v.toFixed(1)}%`} />} />
   The default formatter percent-formats numbers under 1 and locale-formats
   integers; pass an explicit formatter when that's wrong for the chart. */

export interface ChartTooltipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface Props {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayload[];
  /** Custom value formatter; receives the raw value + the payload entry. */
  valueFormatter?: (value: number | string, entry: ChartTooltipPayload) => string;
  /** Custom name resolver — defaults to `entry.name || entry.dataKey`. */
  nameFormatter?: (entry: ChartTooltipPayload) => string;
  /** Override the header label rendered above the value rows. */
  labelFormatter?: (label: string | number) => string;
}

const defaultValueFmt = (v: number | string): string => {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
};

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter = defaultValueFmt,
  nameFormatter,
  labelFormatter,
}: Props): JSX.Element | null {
  if (!active || !payload || !payload.length) return null;
  const displayedLabel = label == null
    ? ''
    : labelFormatter
      ? labelFormatter(label)
      : String(label);
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: 'var(--shadow-md)',
      fontSize: 12,
      minWidth: 140,
      pointerEvents: 'none',
    }}>
      {displayedLabel && (
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontSize: 12 }}>
          {displayedLabel}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry, i) => {
          const name = nameFormatter
            ? nameFormatter(entry)
            : (entry.name ?? String(entry.dataKey ?? ''));
          const value = entry.value == null ? '—' : valueFormatter(entry.value, entry);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                {entry.color && (
                  <span style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: entry.color, display: 'inline-block',
                  }} />
                )}
                {name}
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
