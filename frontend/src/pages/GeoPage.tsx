import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface District {
  name: string;
  stunting_rate: number;
  wasting_rate: number;
  underweight_rate: number;
  overweight_rate: number;
  risk_rag: 'green' | 'amber' | 'red';
  vs_target: number;
}

interface KpiDashboardResponse {
  districts: District[];
}

interface RiskDistrictAgg {
  avg_score: number;
  high_risk_count: number;
}

interface RiskResponse {
  per_child: { ic: string; risk_score: number; risk_tier: 'Low' | 'Medium' | 'High' }[];
  district_aggregation: Record<string, RiskDistrictAgg>;
}

// ── RAG helpers ──────────────────────────────────────────────────────────────

const RAG_COLOR: Record<'green' | 'amber' | 'red', string> = {
  green: 'var(--success)',
  amber: 'var(--warning)',
  red:   'var(--danger)',
};
const RAG_BG_TOKEN: Record<'green' | 'amber' | 'red', string> = {
  green: 'var(--success-bg)',
  amber: 'var(--warning-bg)',
  red:   'var(--danger-bg)',
};
const RAG_LABEL: Record<'green' | 'amber' | 'red', string> = {
  green: 'Baik',
  amber: 'Sederhana',
  red:   'Kritikal',
};

function RagBadge({ rag }: { rag: 'green' | 'amber' | 'red' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      background: RAG_BG_TOKEN[rag],
      color: RAG_COLOR[rag],
      border: `0.5px solid ${RAG_COLOR[rag]}`,
      letterSpacing: '0.04em',
    }}>
      {RAG_LABEL[rag]}
    </span>
  );
}

// ── KPI metric card ──────────────────────────────────────────────────────────

function KpiCard({ label, value, rag }: { label: string; value: number; rag: 'green' | 'amber' | 'red' }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '0.5px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy)' }}>
        {(value * 100).toFixed(1)}%
      </div>
      <RagBadge rag={rag} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function GeoPage() {
  const [searchParams] = useSearchParams();
  const cacheId = searchParams.get('cache_id') ?? '';

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [riskData, setRiskData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cacheId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.post<KpiDashboardResponse>(`/kpi/dashboard?cache_id=${cacheId}`),
      api.post<RiskResponse>(`/risk/score?cache_id=${cacheId}`),
    ])
      .then(([kpiRes, riskRes]) => {
        setDistricts(kpiRes.data.districts);
        setRiskData(riskRes.data);
        setSelectedDistrict(kpiRes.data.districts[0]?.name ?? '');
      })
      .catch(() => setError('Gagal memuatkan data. Sila semak semula Cache ID anda.'))
      .finally(() => setLoading(false));
  }, [cacheId]);

  const selDistrict = districts.find(d => d.name === selectedDistrict);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, color: 'var(--text-secondary)', fontSize: 15 }}>
        Memuatkan...
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        Peta Geografi &amp; Risiko
      </h1>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '0.5px solid var(--danger)',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 20,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>

        {/* Left 40% — choropleth placeholder */}
        <div style={{
          flex: '0 0 40%',
          minHeight: 400,
          background: 'var(--surface-2)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: '32px 24px',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Peta Malaysia (akan datang — Open Item #1)
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Peta choropleth akan dipaparkan di sini
          </div>
        </div>

        {/* Right 60% — district selector + KPI cards */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* District selector */}
          <select
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            style={{
              padding: '9px 12px',
              border: '0.5px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
          >
            {districts.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>

          {/* 4 KPI metric cards (2×2 grid) */}
          {selDistrict && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard label="Kelaparan" value={selDistrict.stunting_rate} rag={selDistrict.risk_rag} />
              <KpiCard label="Kurus" value={selDistrict.wasting_rate} rag={selDistrict.risk_rag} />
              <KpiCard label="Kekurangan Berat" value={selDistrict.underweight_rate} rag={selDistrict.risk_rag} />
              <KpiCard label="Berlebihan Berat" value={selDistrict.overweight_rate} rag={selDistrict.risk_rag} />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom full-width: district aggregation table ── */}
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          Agregasi Risiko Daerah
        </div>

        {!riskData ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            Tiada data risiko.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {(['Daerah', 'Skor Purata', 'Kiraan Berisiko Tinggi', 'RAG'] as const).map(col => (
                  <th key={col} style={{
                    padding: '10px 16px',
                    background: 'var(--surface-2)',
                    borderBottom: '0.5px solid var(--border)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textAlign: 'left',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(riskData.district_aggregation)
                .sort(([, a], [, b]) => b.avg_score - a.avg_score)
                .map(([dname, agg]) => {
                  const rag = districts.find(d => d.name === dname)?.risk_rag ?? 'amber';
                  return (
                    <tr key={dname} style={{ borderBottom: '0.5px solid var(--border)', transition: 'all 0.15s ease' }}>
                      <td style={{ padding: '11px 16px', color: 'var(--text-primary)' }}>{dname}</td>
                      <td style={{ padding: '11px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {agg.avg_score.toFixed(1)}
                      </td>
                      <td style={{ padding: '11px 16px', color: 'var(--text-primary)' }}>
                        {agg.high_risk_count.toLocaleString()}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <RagBadge rag={rag} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
