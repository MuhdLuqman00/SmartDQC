import { describe, it, expect } from 'vitest';
import { ragToColor, buildDistrictLookup, computeAggregates } from './ChoroplethMap';
import type { District } from './ChoroplethMap';

const mockDistricts: District[] = [
  { name: 'Petaling', stunting_rate: 0.18, wasting_rate: 0.10, underweight_rate: 0.12, overweight_rate: 0.06, risk_rag: 'red',   vs_target: -0.03 },
  { name: 'Gombak',   stunting_rate: 0.10, wasting_rate: 0.07, underweight_rate: 0.08, overweight_rate: 0.04, risk_rag: 'amber', vs_target: 0.01  },
  { name: 'Kuching',  stunting_rate: 0.04, wasting_rate: 0.03, underweight_rate: 0.04, overweight_rate: 0.02, risk_rag: 'green', vs_target: 0.06  },
];

// ── ragToColor ────────────────────────────────────────────────────────────────

describe('ragToColor', () => {
  it('maps green  → #22c55e', () => expect(ragToColor('green')).toBe('#22c55e'));
  it('maps amber  → #f59e0b', () => expect(ragToColor('amber')).toBe('#f59e0b'));
  it('maps red    → #ef4444', () => expect(ragToColor('red')).toBe('#ef4444'));
  it('maps undefined → #2d3748 (no-data districts)', () => expect(ragToColor(undefined)).toBe('#2d3748'));
});

// ── buildDistrictLookup ───────────────────────────────────────────────────────

describe('buildDistrictLookup', () => {
  const lookup = buildDistrictLookup(mockDistricts);
  it('finds district by exact lowercase name', () => expect(lookup.get('petaling')).toBeDefined());
  it('is case-insensitive UPPER',              () => expect(lookup.get('GOMBAK'.toLowerCase())).toBeDefined());
  it('is case-insensitive Mixed',              () => expect(lookup.get('Kuching'.toLowerCase())).toBeDefined());
  it('trims whitespace from district names',   () => {
    const padded = [{ ...mockDistricts[0], name: '  Petaling  ' }];
    expect(buildDistrictLookup(padded).get('petaling')).toBeDefined();
  });
  it('returns undefined for unknown district', () => expect(lookup.get('nowhere')).toBeUndefined());
});

// ── computeAggregates ─────────────────────────────────────────────────────────

describe('computeAggregates', () => {
  it('returns zero aggregates for empty array', () => {
    const agg = computeAggregates([]);
    expect(agg.stunting).toBe(0);
    expect(agg.wasting).toBe(0);
    expect(agg.underweight).toBe(0);
    expect(agg.overweight).toBe(0);
  });

  it('computes correct averages', () => {
    const agg = computeAggregates(mockDistricts);
    expect(agg.stunting).toBeCloseTo((0.18 + 0.10 + 0.04) / 3, 5);
    expect(agg.wasting).toBeCloseTo((0.10 + 0.07 + 0.03) / 3, 5);
    expect(agg.underweight).toBeCloseTo((0.12 + 0.08 + 0.04) / 3, 5);
    expect(agg.overweight).toBeCloseTo((0.06 + 0.04 + 0.02) / 3, 5);
  });

  it('assigns red RAG when average > 0.15', () => {
    const high = [
      { ...mockDistricts[0], stunting_rate: 0.18 },
      { ...mockDistricts[0], stunting_rate: 0.20 },
    ];
    expect(computeAggregates(high).stuntingRag).toBe('red');
  });

  it('assigns amber RAG when average > 0.08 and <= 0.15', () => {
    // avg stunting = (0.18+0.10+0.04)/3 = 0.1067 → amber
    expect(computeAggregates(mockDistricts).stuntingRag).toBe('amber');
  });

  it('assigns green RAG when average <= 0.08', () => {
    const low = [{ ...mockDistricts[2] }]; // stunting 0.04
    expect(computeAggregates(low).stuntingRag).toBe('green');
  });

  it('computes independent RAG per indicator', () => {
    // wasting avg = (0.10+0.07+0.03)/3 = 0.0667 → green
    expect(computeAggregates(mockDistricts).wastingRag).toBe('green');
  });
});
