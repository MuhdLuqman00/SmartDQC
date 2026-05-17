import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function ColumnHistogram({ values, bins = 12 }: { values: number[]; bins?: number }) {
  const data = useMemo(() => {
    const nums = values.filter(v => typeof v === 'number' && Number.isFinite(v));
    if (nums.length === 0) return [];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min === max) return [{ label: String(min), count: nums.length }];
    const width = (max - min) / bins;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: (min + i * width).toFixed(1),
      count: 0,
    }));
    for (const n of nums) {
      let idx = Math.floor((n - min) / width);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      buckets[idx].count += 1;
    }
    return buckets;
  }, [values, bins]);

  if (data.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
        No numeric values to plot.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="var(--kkm-blue)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
