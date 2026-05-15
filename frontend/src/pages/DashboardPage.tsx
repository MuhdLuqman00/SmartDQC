import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { theme } from '../theme';
import { useLang } from '../context/LanguageContext';
import { ChoroplethMap, District, Aggregates, computeAggregates } from '../components/ChoroplethMap';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  cache_id: string;
  filename: string;
  source_type: string;
  row_count: number | null;
  quality_score: number | null;
}

interface SparkPoint { i: number; q: number; }

interface DistrictRisk {
  district: string;
  avg_score: number;
  high_risk_count: number;
}

interface KpiDashboardResponse { districts: District[]; }
interface RiskResponse {
  district_aggregation: Record<string, { avg_score: number; high_risk_count: number }>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ title, value, icon, color, colorBg }: {
  title: string; value: string | number; icon: string; color: string; colorBg: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)', border: '0.5px solid var(--border)',
        borderTop: `3px solid ${color}`, borderRadius: 12,
        padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
          letterSpacing: '0.07em', color: 'var(--text-secondary)',
        }}>
          {title}
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: colorBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
        {value}
      </div>
    </div>
  );
}

function QBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const bg   = s >= 80 ? 'var(--success-bg)'  : s >= 60 ? 'var(--warning-bg)'  : 'var(--danger-bg)';
  const text = s >= 80 ? 'var(--success)'     : s >= 60 ? 'var(--warning)'     : 'var(--danger)';
  return (
    <span style={{ background: bg, color: text, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
      {s.toFixed(1)}%
    </span>
  );
}

type Rag = 'green' | 'amber' | 'red';

function RagBadge({ rag }: { rag: Rag }) {
  const { t } = useLang();
  const map: Record<Rag, { bg: string; color: string; en: string; my: string }> = {
    green: { bg: 'var(--success-bg)', color: 'var(--success)', en: 'Good',     my: 'Baik' },
    amber: { bg: 'var(--warning-bg)', color: 'var(--warning)', en: 'Moderate', my: 'Sederhana' },
    red:   { bg: 'var(--danger-bg)',  color: 'var(--danger)',  en: 'Critical', my: 'Kritikal' },
  };
  const { bg, color, en, my } = map[rag];
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
      {t(en, my)}
    </span>
  );
}

function NutritionCard({ label, rate, rag }: { label: string; rate: number; rag: Rag }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '0.5px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
        letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
        {(rate * 100).toFixed(1)}%
      </div>
      <RagBadge rag={rag} />
    </div>
  );
}

function ActionCard({ label, icon, path }: { label: string; icon: string; path: string }) {
  const navigate = useNavigate();
  return (
    <button
      style={{
        background: 'var(--surface)', border: '0.5px solid var(--border)',
        borderRadius: 10, padding: '14px 16px', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left' as const,
      }}
      onClick={() => navigate(path)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'none';
      }}
    >
      <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useLang();

  const [sessions, setSessions]           = useState<Session[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [districts, setDistricts]         = useState<District[]>([]);
  const [districtRisks, setDistrictRisks] = useState<DistrictRisk[]>([]);
  const [mapLoading, setMapLoading]       = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<Session[]>('/sessions')
      .then(r => { setSessions(r.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    const cacheId = sessions[0].cache_id;
    setMapLoading(true);
    Promise.all([
      api.post<KpiDashboardResponse>(`/kpi/dashboard?cache_id=${cacheId}`),
      api.post<RiskResponse>(`/risk/score?cache_id=${cacheId}`),
    ]).then(([kpiRes, riskRes]) => {
      setDistricts(kpiRes.data.districts ?? []);
      const agg = riskRes.data.district_aggregation ?? {};
      setDistrictRisks(
        Object.entries(agg)
          .map(([district, v]) => ({ district, avg_score: v.avg_score, high_risk_count: v.high_risk_count }))
          .sort((a, b) => b.avg_score - a.avg_score),
      );
      setMapLoading(false);
    }).catch(() => setMapLoading(false));
  }, [sessions]);

  const avgQ       = sessions.length ? sessions.reduce((a, s) => a + (s.quality_score ?? 0), 0) / sessions.length : 0;
  const totalRows  = sessions.reduce((a, s) => a + (s.row_count ?? 0), 0);
  const alertCount = sessions.filter(s => (s.quality_score ?? 0) < 60).length;
  const sparkData: SparkPoint[] = sessions.slice(-10).map((s, i) => ({ i, q: s.quality_score ?? 0 }));
  const aggregates: Aggregates  = useMemo(() => computeAggregates(districts), [districts]);

  if (loading) return <div style={st.center}>{t('Loading...', 'Memuatkan...')}</div>;
  if (error)   return <div style={st.center}>{t('Failed to load sessions.', 'Gagal memuatkan sesi.')}</div>;

  return (
    <div>
      {/* Header */}
      <div style={st.header}>
        <h1 style={st.h1}>{t('Dashboard', 'Papan Pemuka')}</h1>
        {sessions.length > 0 && (
          <span style={st.subtitle}>{t('Latest', 'Terkini')}: {sessions[0].filename}</span>
        )}
      </div>

      {/* KPI cards + quick actions */}
      <div style={st.topRow}>
        <div style={st.kpiGrid}>
          <StatCard title={t('Active Sessions', 'Sesi Aktif')}  value={sessions.length}            icon="📁" color={theme.blue}    colorBg={theme.infoBg} />
          <StatCard title={t('Avg Quality', 'Purata Kualiti')}  value={`${avgQ.toFixed(1)}%`}      icon="📊" color={theme.success} colorBg={theme.successBg} />
          <StatCard title={t('Total Rows', 'Jumlah Baris')}     value={totalRows.toLocaleString()} icon="🗄️" color={theme.purple}  colorBg={theme.purpleBg} />
          <StatCard title={t('Alerts (<60)', 'Amaran (<60)')}   value={alertCount}                 icon="⚠️" color={theme.danger}  colorBg={theme.dangerBg} />
        </div>
        <div style={st.actionCol}>
          <ActionCard label={t('Upload New', 'Muat Naik Baru')}    icon="↑" path="/upload" />
          <ActionCard label={t('Generate Report', 'Jana Laporan')} icon="▤" path="/reports" />
          <ActionCard label={t('Ask AI', 'Tanya AI')}              icon="✧" path="/ai" />
        </div>
      </div>

      {/* Quality trend */}
      <div style={st.card}>
        <div style={st.cardTitle}>{t('Quality Trend (Last 10 Sessions)', 'Trend Kualiti (10 Sesi Terkini)')}</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={theme.blue} stopOpacity={0.15} />
                <stop offset="95%" stopColor={theme.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, t('Quality', 'Kualiti')]} />
            <Area type="monotone" dataKey="q" stroke={theme.blue} strokeWidth={2} dot={false} fill="url(#qGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent sessions */}
      <div style={st.card}>
        <div style={st.cardTitle}>{t('Recent Sessions', 'Sesi Terkini')}</div>
        {sessions.length === 0 ? (
          <div style={st.empty}>{t('No sessions yet.', 'Tiada sesi lagi.')}</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  {[t('File', 'Fail'), t('Type', 'Jenis'), t('Rows', 'Baris'), t('Score', 'Skor'), t('Action', 'Tindakan')].map(h => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 8).map(sess => (
                  <tr
                    key={sess.cache_id} style={st.tr}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td style={st.td}>{sess.filename}</td>
                    <td style={st.td}><span style={st.srcBadge}>{sess.source_type}</span></td>
                    <td style={st.td}>{(sess.row_count ?? 0).toLocaleString()}</td>
                    <td style={st.td}><QBadge score={sess.quality_score} /></td>
                    <td style={st.td}>
                      <button
                        style={st.openBtn}
                        onClick={() => navigate(`/quality?cache_id=${sess.cache_id}`)}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        {t('Open', 'Buka')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Geographic section */}
      <div style={st.card}>
        <div style={st.cardTitle}>{t('Geographic Risk Overview', 'Gambaran Risiko Geografi')}</div>
        {sessions.length === 0 ? (
          <div style={st.empty}>
            {t('Upload a dataset to view geographic insights.', 'Muat naik dataset untuk melihat gambaran geografi.')}
          </div>
        ) : mapLoading ? (
          <div style={st.center}>{t('Loading map...', 'Memuatkan peta...')}</div>
        ) : (
          <>
            <div style={st.geoRow}>
              <div style={{ flex: '0 0 55%' }}>
                <ChoroplethMap districts={districts} />
              </div>
              <div style={{ flex: '0 0 45%', paddingLeft: 24 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
                  letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: 12,
                }}>
                  {t('National Average', 'Purata Nasional')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <NutritionCard label={t('Stunting', 'Kelaparan')}            rate={aggregates.stunting}    rag={aggregates.stuntingRag} />
                  <NutritionCard label={t('Wasting', 'Kurus')}                 rate={aggregates.wasting}     rag={aggregates.wastingRag} />
                  <NutritionCard label={t('Underweight', 'Kekurangan Berat')}  rate={aggregates.underweight} rag={aggregates.underweightRag} />
                  <NutritionCard label={t('Overweight', 'Berlebihan Berat')}   rate={aggregates.overweight}  rag={aggregates.overweightRag} />
                </div>
              </div>
            </div>

            {districtRisks.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ ...st.cardTitle, marginBottom: 12 }}>
                  {t('District Risk Summary', 'Ringkasan Risiko Daerah')}
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table style={st.table}>
                    <thead>
                      <tr>
                        {[t('District', 'Daerah'), t('Avg Score', 'Skor Purata'), t('High Risk', 'Risiko Tinggi')].map(h => (
                          <th key={h} style={st.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {districtRisks.map(r => (
                        <tr
                          key={r.district} style={st.tr}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                        >
                          <td style={st.td}>{r.district}</td>
                          <td style={{ ...st.td, textAlign: 'right' as const }}>{r.avg_score.toFixed(2)}</td>
                          <td style={{ ...st.td, textAlign: 'right' as const }}>{r.high_risk_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 200, color: 'var(--text-secondary)', fontSize: 14,
  },
  header:    { marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 16 },
  h1:        { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle:  { fontSize: 13, color: 'var(--text-secondary)' },
  topRow:    { display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' },
  kpiGrid:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flex: 1 },
  actionCol: { display: 'flex', flexDirection: 'column', gap: 8, width: 180, flexShrink: 0 },
  card: {
    background: 'var(--surface)', border: '0.5px solid var(--border)',
    borderRadius: 12, padding: 20, marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardTitle: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: 16,
  },
  table:  { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: {
    textAlign: 'left' as const, padding: '8px 8px',
    fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    borderBottom: '0.5px solid var(--border)',
    position: 'sticky' as const, top: 0, background: 'var(--surface)', zIndex: 1,
  },
  tr:  { borderBottom: '0.5px solid var(--border)', transition: 'background 0.1s ease' },
  td:  { padding: '10px 8px', color: 'var(--text-primary)', verticalAlign: 'middle' as const },
  srcBadge: {
    background: 'var(--bg)', border: '0.5px solid var(--border)',
    borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text-secondary)',
  },
  openBtn: {
    background: 'transparent', border: '0.5px solid var(--border)',
    borderRadius: 6, padding: '4px 14px', fontSize: 12,
    cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500,
    transition: 'background 0.1s ease',
  },
  empty:  { color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0', textAlign: 'center' as const },
  geoRow: { display: 'flex', alignItems: 'flex-start', gap: 0 },
};
