import React from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface District {
  name: string;
  stunting_rate: number;
  wasting_rate: number;
  underweight_rate: number;
  overweight_rate: number;
  risk_rag: 'green' | 'amber' | 'red';
  vs_target: number;
}

export interface Aggregates {
  stunting: number;
  wasting: number;
  underweight: number;
  overweight: number;
  stuntingRag: 'green' | 'amber' | 'red';
  wastingRag: 'green' | 'amber' | 'red';
  underweightRag: 'green' | 'amber' | 'red';
  overweightRag: 'green' | 'amber' | 'red';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function ragToColor(rag: 'green' | 'amber' | 'red' | undefined): string {
  if (rag === 'green') return '#22c55e';
  if (rag === 'amber') return '#f59e0b';
  if (rag === 'red')   return '#ef4444';
  return '#2d3748';
}

export function buildDistrictLookup(districts: District[]): Map<string, District> {
  const map = new Map<string, District>();
  for (const d of districts) {
    map.set(d.name.trim().toLowerCase(), d);
  }
  return map;
}

function rateToRag(rate: number): 'green' | 'amber' | 'red' {
  if (rate > 0.15) return 'red';
  if (rate > 0.08) return 'amber';
  return 'green';
}

export function computeAggregates(districts: District[]): Aggregates {
  if (districts.length === 0) {
    return {
      stunting: 0, wasting: 0, underweight: 0, overweight: 0,
      stuntingRag: 'green', wastingRag: 'green', underweightRag: 'green', overweightRag: 'green',
    };
  }
  const n = districts.length;
  const stunting    = districts.reduce((s, d) => s + d.stunting_rate, 0) / n;
  const wasting     = districts.reduce((s, d) => s + d.wasting_rate, 0) / n;
  const underweight = districts.reduce((s, d) => s + d.underweight_rate, 0) / n;
  const overweight  = districts.reduce((s, d) => s + d.overweight_rate, 0) / n;
  return {
    stunting, wasting, underweight, overweight,
    stuntingRag:    rateToRag(stunting),
    wastingRag:     rateToRag(wasting),
    underweightRag: rateToRag(underweight),
    overweightRag:  rateToRag(overweight),
  };
}

// ── Map constants ─────────────────────────────────────────────────────────────

// Confirmed from frontend/public/my-districts.json: properties.name = district name
const DISTRICT_NAME_KEY = 'name';

const RAG_LABEL: Record<'green' | 'amber' | 'red', string> = {
  green: 'Baik',
  amber: 'Sederhana',
  red:   'Kritikal',
};

interface TooltipState {
  x: number;
  y: number;
  district: District;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChoroplethMap({ districts }: { districts: District[] }): JSX.Element {
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);
  const lookup = React.useMemo(() => buildDistrictLookup(districts), [districts]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [109.5, 4.0], scale: 1600 }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography="/my-districts.json">
          {({ geographies }: { geographies: { rsmKey: string; properties: Record<string, string> }[] }) =>
            geographies.map(geo => {
              const geoName = String(geo.properties[DISTRICT_NAME_KEY] ?? '').trim().toLowerCase();
              const district = lookup.get(geoName);
              const fill = ragToColor(district?.risk_rag);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="var(--surface)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none', transition: 'opacity 0.15s ease' },
                    hover:   { outline: 'none', opacity: 0.75, cursor: district ? 'pointer' : 'default' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(evt: React.MouseEvent) => {
                    if (!district) return;
                    setTooltip({ x: evt.clientX, y: evt.clientY, district });
                  }}
                  onMouseMove={(evt: React.MouseEvent) => {
                    if (!district) return;
                    setTooltip(prev => prev ? { ...prev, x: evt.clientX, y: evt.clientY } : null);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.y + 14,
          left: tooltip.x + 14,
          background: 'var(--surface-2)',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          pointerEvents: 'none',
          zIndex: 9999,
          minWidth: 164,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, marginBottom: 6 }}>
            {tooltip.district.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
            Stunting: {(tooltip.district.stunting_rate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Wasting: {(tooltip.district.wasting_rate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: ragToColor(tooltip.district.risk_rag) }}>
            ● {RAG_LABEL[tooltip.district.risk_rag]}
          </div>
        </div>
      )}
    </div>
  );
}
