import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import { ChoroplethMap, computeAggregates } from '../components/ChoroplethMap';
import type { District } from '../components/ChoroplethMap';
import { SessionGuard } from '../components/SessionGuard';
import { useSession } from '../context/SessionContext';
import { useLang } from '../context/LanguageContext';

// ── KPI types ─────────────────────────────────────────────────────────────────

interface KpiIndicator {
  key: string; label_en: string; label_bm: string;
  actual: number; actual_count: number; total: number;
  npan_target: number; who_target: number | null; gap: number;
  rag: 'Green' | 'Amber' | 'Red';
}
interface KpiGroupRow {
  // Backend keys the grouping value by dimension: by_state→state,
  // by_gender→gender, by_age→group. Plus per-group rates/status/n.
  state?: string; gender?: string; group?: string;
  n?: number;
  rates?: Record<string, number>;
  status?: Record<string, string>;
  [k: string]: unknown;
}
interface KpiDashboard {
  overall_status: 'Green' | 'Amber' | 'Red';
  total_children: number;
  indicators: KpiIndicator[];
  by_state: KpiGroupRow[];
  by_gender: KpiGroupRow[];
  by_age: KpiGroupRow[];
}

// ── Risk types ────────────────────────────────────────────────────────────────

interface RiskDistrict { district: string; avg_risk: number; max_risk: number; n_records: number; }
interface RiskSampleRow { IC_NO_PASSPORT?: string; NAMA?: string; risk_score: number; risk_tier: string; [k: string]: unknown; }
interface RiskResult {
  total_records: number;
  flags_used: string[];
  distribution: Record<string, number>;
  avg_risk_score: number;
  high_risk_count: number;
  district_summary: RiskDistrict[] | null;
  high_risk_sample: RiskSampleRow[];
}

// ── RAG helpers ───────────────────────────────────────────────────────────────

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
const RAG_LABEL_MY: Record<'green' | 'amber' | 'red', string> = {
  green: 'Baik',
  amber: 'Sederhana',
  red:   'Kritikal',
};

function ragToLower(r?: string): 'green' | 'amber' | 'red' {
  const v = (r || '').toLowerCase();
  return v === 'red' ? 'red' : v === 'amber' ? 'amber' : 'green';
}

const ragFill = (r?: string) =>
  r === 'Red' ? 'var(--danger)' : r === 'Amber' ? 'var(--warning)' : 'var(--kkm-teal)';

function RagBadge({ rag }: { rag: 'green' | 'amber' | 'red' }) {
  const { t } = useLang();
  const label = t(
    { green: 'Good', amber: 'Moderate', red: 'Critical' }[rag],
    RAG_LABEL_MY[rag]
  );
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 6,
      fontSize: 11, fontWeight: 700, background: RAG_BG_TOKEN[rag],
      color: RAG_COLOR[rag], border: `0.5px solid ${RAG_COLOR[rag]}`, letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  );
}

function KpiCard({ label, value, rag }: { label: string; value: number; rag: 'green' | 'amber' | 'red' }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '0.5px solid var(--border)',
      borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
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

// ── KPI-to-District mapping ───────────────────────────────────────────────────

const STATE_TO_CODE: Record<string, string> = {
  JOHOR: 'jhr', KEDAH: 'kdh', KELANTAN: 'ktn',
  'KUALA LUMPUR': 'kul', LABUAN: 'lbn', MELAKA: 'mlk',
  'NEGERI SEMBILAN': 'nsn', PAHANG: 'phg', PUTRAJAYA: 'pjy',
  PERLIS: 'pls', PENANG: 'png', 'PULAU PINANG': 'png',
  PERAK: 'prk', SABAH: 'sbh', SELANGOR: 'sgr',
  SARAWAK: 'swk', TERENGGANU: 'trg',
};

function toDistricts(k: KpiDashboard | null): District[] {
  if (!k) return [];
  // by_state rows are keyed `state` (kpi.py _group_breakdown(..., "state")),
  // NOT `group`. Mirror DashboardPage: per-state rates + per-state RAG so the
  // choropleth actually binds and varies (was uncolored/monochrome).
  return k.by_state.map(row => {
    const rates = (row.rates as Record<string, number>) ?? {};
    const status = (row.status as Record<string, string>) ?? {};
    const stateName = String(row.state ?? '');
    return {
      name: STATE_TO_CODE[stateName.toUpperCase()] ?? stateName.toLowerCase(),
      stunting_rate: Number(rates.stunting ?? 0) / 100,
      wasting_rate: Number(rates.wasting ?? 0) / 100,
      underweight_rate: Number(rates.underweight ?? 0) / 100,
      overweight_rate: Number(rates.overweight ?? 0) / 100,
      risk_rag: ragToLower(String(status.stunting ?? k.overall_status)),
      vs_target: 0,
    };
  });
}

// ── Breakdown chart ───────────────────────────────────────────────────────────

const RATE_LABELS: Record<string, string> = {
  stunting: 'Stunting', wasting: 'Wasting',
  underweight: 'Underweight', overweight: 'Overweight',
};

function normalizeBreakdown(rows: KpiGroupRow[], groupKey: string): KpiGroupRow[] {
  return rows.map(row => {
    const raw = row as Record<string, unknown>;
    const rates = (raw.rates as Record<string, number>) ?? {};
    return { group: String(raw[groupKey] ?? ''), ...rates } as KpiGroupRow;
  });
}

function firstRateKey(rows: KpiGroupRow[]): string | null {
  if (!rows.length) return null;
  const r = rows[0];
  return Object.keys(r).find(k => k !== 'group' && typeof r[k] === 'number') ?? null;
}

function rateTooltipFormatter(value: number, name: string) {
  const label = RATE_LABELS[name] ?? (name.charAt(0).toUpperCase() + name.slice(1));
  return [`${Number(value).toFixed(1)}%`, label];
}

function BreakdownChart({ title, rows }: { title: string; rows: KpiGroupRow[] }) {
  const yKey = firstRateKey(rows);
  if (!rows.length || !yKey) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px 18px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows}>
          <XAxis dataKey="group" tick={{ fontSize: 10 }} interval={0} />
          <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 'auto']} />
          <Tooltip formatter={rateTooltipFormatter} />
          <Bar dataKey={yKey} fill="var(--kkm-blue)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GeoPage() {
  const { cacheId } = useSession();
  const { t, lang } = useLang();

  const [kpi, setKpi] = useState<KpiDashboard | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  useEffect(() => {
    if (!cacheId) return;
    setKpiLoading(true);
    api.post<KpiDashboard>(`/kpi/dashboard?cache_id=${cacheId}`)
      .then(r => setKpi(r.data))
      .catch(() => setKpi(null))
      .finally(() => setKpiLoading(false));
  }, [cacheId]);

  const runRisk = async () => {
    if (!cacheId) return;
    setRiskLoading(true);
    try {
      const r = await api.post<RiskResult>(`/risk/score?cache_id=${cacheId}`);
      setRisk(r.data);
    } catch { setRisk(null); }
    finally { setRiskLoading(false); }
  };

  const districts = toDistricts(kpi);
  const agg = computeAggregates(districts);

  return (
    <SessionGuard>
      <div style={{ padding: '4px 0' }}>
        <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('Geography & Risk Map', 'Peta Geografi & Risiko')}
        </h1>

        {kpiLoading && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            {t('Loading KPI data…', 'Memuatkan data KPI…')}
          </div>
        )}

        {/* Choropleth + KPI aggregate cards */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{
            flex: '0 0 40%', background: 'var(--surface-2)',
            border: '0.5px solid var(--border)', borderRadius: 12,
            overflow: 'hidden', boxSizing: 'border-box',
          }}>
            {districts.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('No KPI data — run cleaning first.', 'Tiada data KPI — jalankan pembersihan dahulu.')}
                </div>
              : <ChoroplethMap districts={districts} />}
          </div>
          <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('National Average', 'Purata Nasional')}{districts.length > 0 ? ` (${districts.length} ${t('districts', 'daerah')})` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard label={t('Stunting', 'Kelaparan')}             value={agg.stunting}    rag={agg.stuntingRag} />
              <KpiCard label={t('Wasting', 'Kurus')}                  value={agg.wasting}     rag={agg.wastingRag} />
              <KpiCard label={t('Underweight', 'Kekurangan Berat')}   value={agg.underweight} rag={agg.underweightRag} />
              <KpiCard label={t('Overweight', 'Berlebihan Berat')}    value={agg.overweight}  rag={agg.overweightRag} />
            </div>
          </div>
        </div>

        {/* Indicators vs NPAN target bar chart */}
        {kpi && kpi.indicators.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '18px 20px', boxShadow: 'var(--shadow-card)', marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              {t('Indicators vs National Target', 'Penunjuk vs Sasaran Kebangsaan')}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={kpi.indicators.map(i => ({
                name: lang === 'en' ? i.label_en : i.label_bm,
                actual: i.actual, target: i.npan_target, rag: i.rag,
              }))}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, name]} />
                <Bar dataKey="actual" name={t('Actual', 'Sebenar')}>
                  {kpi.indicators.map((i, idx) => <Cell key={idx} fill={ragFill(i.rag)} />)}
                </Bar>
                <Bar dataKey="target" name={t('Target', 'Sasaran')} fill="var(--text-muted)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown charts: by state / gender / age */}
        {kpi && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
            <BreakdownChart title={t('By State', 'Mengikut Negeri')}   rows={normalizeBreakdown(kpi.by_state, 'state')} />
            <BreakdownChart title={t('By Gender', 'Mengikut Jantina')} rows={normalizeBreakdown(kpi.by_gender, 'gender')} />
            <BreakdownChart title={t('By Age', 'Mengikut Umur')}       rows={normalizeBreakdown(kpi.by_age, 'group')} />
          </div>
        )}

        {/* Predictive risk scoring card (on-demand) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '18px 20px', boxShadow: 'var(--shadow-card)', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: risk ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t('Predictive Risk Scoring', 'Pemarkahan Risiko Ramalan')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('Composite child-level malnutrition risk (0-100)', 'Risiko malnutrisi peringkat kanak-kanak (0-100)')}
              </div>
            </div>
            {risk === null && (
              <button onClick={runRisk} disabled={riskLoading}
                style={{ background: 'var(--kkm-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius-btn)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: riskLoading ? 0.6 : 1 }}>
                {riskLoading ? t('Scoring…', 'Memarkah…') : t('Run Risk Scoring', 'Jalankan Pemarkahan')}
              </button>
            )}
          </div>

          {risk && (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13 }}>
                {([
                  [t('Records', 'Rekod'), risk.total_records],
                  [t('Avg risk', 'Risiko purata'), risk.avg_risk_score],
                  [t('High risk', 'Risiko tinggi'), risk.high_risk_count],
                ] as [string, number][]).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l}</div>
                    <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={Object.entries(risk.distribution).map(([tier, count]) => ({ tier, count }))}>
                  <XAxis dataKey="tier" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--kkm-blue)" />
                </BarChart>
              </ResponsiveContainer>

              {risk.district_summary && risk.district_summary.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[t('District', 'Daerah'), t('Avg', 'Purata'), t('Max', 'Maks'), t('N', 'N')].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {risk.district_summary.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{d.district}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{d.avg_risk}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{d.max_risk}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{d.n_records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {risk.high_risk_sample.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[t('IC', 'IC'), t('Name', 'Nama'), t('Score', 'Skor'), t('Tier', 'Tahap')].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {risk.high_risk_sample.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{r.IC_NO_PASSPORT ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{r.NAMA ?? '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{r.risk_score}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--danger)', fontWeight: 600 }}>{r.risk_tier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </SessionGuard>
  );
}
