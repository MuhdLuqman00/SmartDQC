import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Download, Play, Filter, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { useLang } from '../context/LanguageContext';
import { EmptyState } from '../components/EmptyState';

interface Dataset {
  id: string;
  filename: string;
  source_type: string | null;
  row_count: number | null;
  created_at: string;
}

interface LinkSource {
  ic?: string;
  name?: string;
  dob?: string;
  source_type: string;
  dataset_id: string;
}

interface LinkProfile {
  ic: string;
  name: string | null;
  dob: string | null;
  confidence: number;
  match_reasons: string[];
  sources: LinkSource[];
}

interface LinkResult {
  total_groups: number;
  linked_groups: number;
  unlinked: number;
  datasets: Array<{ dataset_id: string; filename: string; source_type: string | null; records: number }>;
  profiles: LinkProfile[];
  warning?: string;
}

interface Settings {
  fuzzy_ic: boolean;
  fuzzy_ic_max_distance: number;
  name_dob_boost: boolean;
  min_confidence: number;
}

const REASON_COLOR: Record<string, string> = {
  exact_ic:  'var(--status-good)',
  name_dob:  'var(--status-good)',
  unmatched: 'var(--text-muted)',
};
const reasonColor = (r: string): string => {
  if (r.startsWith('fuzzy_ic')) return 'var(--status-watch)';
  return REASON_COLOR[r] || 'var(--text-muted)';
};
const reasonBg = (r: string): string => {
  if (r === 'exact_ic' || r === 'name_dob') return 'var(--status-good-bg)';
  if (r.startsWith('fuzzy_ic')) return 'var(--status-watch-bg)';
  return 'var(--surface-2)';
};

const confidenceColor = (c: number): string => {
  if (c >= 0.95) return 'var(--status-good)';
  if (c >= 0.70) return 'var(--status-watch)';
  if (c >  0.00) return 'var(--status-critical)';
  return 'var(--text-muted)';
};

export function LinkagePage() {
  const { t } = useLang();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [settings, setSettings] = useState<Settings>({
    fuzzy_ic: true,
    fuzzy_ic_max_distance: 1,
    name_dob_boost: true,
    min_confidence: 0,
  });
  const [showOnlyLinked, setShowOnlyLinked] = useState(true);

  const [result, setResult] = useState<LinkResult | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<Dataset[]>('/datasets')
      .then(r => setDatasets(r.data))
      .catch(() => setDatasets([]))
      .finally(() => setDatasetsLoading(false));
  }, []);

  const canRun = selected.size >= 2;

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const runLinkage = async () => {
    if (!canRun) return;
    setRunning(true); setError(null); setExpanded(new Set());
    try {
      const r = await api.post<LinkResult>('/entity/link/v2', {
        dataset_ids: Array.from(selected),
        ...settings,
      });
      setResult(r.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || t('Linkage failed.', 'Pemautan gagal.'));
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = async () => {
    if (!canRun) return;
    setExporting(true);
    try {
      /* Use the axios api client (which already adds the bearer token from
         the 'token' localStorage key — same one AuthContext writes — so we
         don't drift out of sync with the rest of the app). responseType
         'blob' makes axios hand back the binary CSV. */
      const r = await api.post('/entity/link/v2/export',
        { dataset_ids: Array.from(selected), ...settings },
        { responseType: 'blob' },
      );
      const blob = r.data as Blob;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'SmartDQC_Linkage.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError(t('CSV export failed.', 'Eksport CSV gagal.'));
    } finally {
      setExporting(false);
    }
  };

  const visibleProfiles = useMemo(() => {
    if (!result) return [];
    return showOnlyLinked
      ? result.profiles.filter(p => p.sources.length > 1)
      : result.profiles;
  }, [result, showOnlyLinked]);

  const toggleExpand = (key: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  /* ── small atom helpers (kept inline for one-off page) ── */
  const sectionCard: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)', padding: '18px 20px',
    boxShadow: 'var(--shadow-card)',
  };

  if (datasetsLoading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>{t('Loading…', 'Memuatkan…')}</div>;
  }
  if (!datasets.length) {
    return (
      <EmptyState
        icon={<Link2 size={48} />}
        title={t('No datasets to link', 'Tiada dataset untuk dipautkan')}
        description={t('Upload at least 2 datasets to use cross-dataset linkage.', 'Muat naik sekurang-kurangnya 2 dataset untuk pemautan.')}
        action={{ label: t('Upload Dataset', 'Muat Naik Dataset'), to: '/upload' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        {t('Cross-Dataset Linkage', 'Pemautan Merentas Dataset')}
      </h1>

      {/* ── Dataset picker ── */}
      <div style={sectionCard}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          {t('1 — Select datasets', '1 — Pilih dataset')}
          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
            ({selected.size} {t('selected', 'dipilih')})
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {datasets.map(ds => {
            const sel = selected.has(ds.id);
            return (
              <label key={ds.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--kkm-sky)' : 'var(--border)'}`,
                background: sel ? 'rgba(46,74,122,0.06)' : 'var(--surface-2)',
                transition: 'all var(--transition)',
              }}>
                <input type="checkbox" checked={sel} onChange={() => toggleSelect(ds.id)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ds.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {ds.source_type && <span style={{ textTransform: 'uppercase', fontWeight: 600, marginRight: 6 }}>{ds.source_type}</span>}
                    {ds.row_count?.toLocaleString() ?? '—'} {t('rows', 'baris')}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Settings + Run ── */}
      <div style={sectionCard}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          {t('2 — Matching settings', '2 — Tetapan padanan')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={settings.fuzzy_ic}
              onChange={e => setSettings(s => ({ ...s, fuzzy_ic: e.target.checked }))}
            />
            {t('Fuzzy IC match', 'Padanan IC kabur')}
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {t('(tolerates a single typo)', '(tolak satu salah taip)')}
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={settings.name_dob_boost}
              onChange={e => setSettings(s => ({ ...s, name_dob_boost: e.target.checked }))}
            />
            {t('Name + DOB boost', 'Tampin nama + tarikh lahir')}
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {t('(matches IC-less records)', '(pasangkan rekod tanpa IC)')}
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            {t('Min confidence:', 'Keyakinan min:')}
            <select
              value={settings.min_confidence}
              onChange={e => setSettings(s => ({ ...s, min_confidence: parseFloat(e.target.value) }))}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-primary)' }}
            >
              <option value={0.0}>{t('Show all', 'Tunjuk semua')}</option>
              <option value={0.6}>0.60+</option>
              <option value={0.7}>0.70+</option>
              <option value={0.85}>0.85+</option>
              <option value={0.95}>0.95+ ({t('exact only', 'tepat sahaja')})</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={runLinkage}
            disabled={!canRun || running}
            style={{
              background: 'var(--kkm-blue)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-btn)', padding: '9px 18px',
              fontWeight: 600, fontSize: 13, cursor: canRun ? 'pointer' : 'not-allowed',
              opacity: !canRun || running ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Play size={14} />
            {running ? t('Linking…', 'Memaut…') : t('Run Linkage', 'Jalankan Pemautan')}
          </button>
          <button
            onClick={exportCsv}
            disabled={!canRun || exporting || !result}
            style={{
              background: 'var(--surface-2)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)',
              padding: '9px 16px', fontWeight: 500, fontSize: 13,
              cursor: (!canRun || !result) ? 'not-allowed' : 'pointer',
              opacity: (!canRun || !result || exporting) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Download size={14} />
            {exporting ? t('Exporting…', 'Mengeksport…') : t('Export CSV', 'Eksport CSV')}
          </button>
          {!canRun && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('Select at least 2 datasets above.', 'Pilih sekurang-kurangnya 2 dataset di atas.')}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--danger)' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('3 — Results', '3 — Hasil')}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showOnlyLinked}
                onChange={e => setShowOnlyLinked(e.target.checked)}
              />
              {t('Show only cross-dataset matches', 'Tunjuk padanan merentas dataset sahaja')}
            </label>
          </div>

          {result.warning && (
            <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary)', marginBottom: 14 }}>
              <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              {result.warning}
            </div>
          )}

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
            {[
              [t('Total groups', 'Jumlah kumpulan'),    result.total_groups],
              [t('Cross-dataset matches', 'Padanan merentas dataset'),    result.linked_groups],
              [t('Single-source only', 'Sumber tunggal sahaja'), result.unlinked],
              [t('Datasets compared', 'Dataset dibandingkan'), result.datasets.length],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l}</div>
                <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Dataset legend — keeps the source pills below readable. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {result.datasets.map(d => (
              <span key={d.dataset_id} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px' }}>
                {d.filename} · <span style={{ color: 'var(--text-muted)' }}>{d.records.toLocaleString()} {t('rows', 'baris')}</span>
              </span>
            ))}
          </div>

          {visibleProfiles.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
              {showOnlyLinked
                ? t('No cross-dataset matches at this confidence level.', 'Tiada padanan merentas dataset pada paras keyakinan ini.')
                : t('No groups returned.', 'Tiada kumpulan dikembalikan.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleProfiles.map((p, i) => {
                const key = `${p.ic}-${i}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div
                      onClick={() => toggleExpand(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', cursor: 'pointer',
                        background: isOpen ? 'var(--surface-2)' : 'transparent',
                      }}
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', minWidth: 130 }}>
                        {p.ic || t('(no IC)', '(tiada IC)')}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.dob || ''}
                      </span>
                      <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {p.match_reasons.map(r => (
                          <span key={r} style={{
                            fontSize: 10, fontWeight: 700,
                            background: reasonBg(r), color: reasonColor(r),
                            border: `1px solid ${reasonColor(r)}`,
                            borderRadius: 999, padding: '2px 8px',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {r}
                          </span>
                        ))}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12,
                        color: confidenceColor(p.confidence), minWidth: 50, textAlign: 'right',
                      }}>
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>
                        {p.sources.length}× {t('src', 'sumber')}
                      </span>
                    </div>

                    {isOpen && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: 'var(--surface)' }}>
                        <thead>
                          <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                            {[t('Source', 'Sumber'), 'IC', t('Name', 'Nama'), t('DOB', 'Tarikh lahir'), t('Dataset', 'Dataset')].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.sources.map((s, j) => (
                            <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{s.source_type}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{s.ic || '—'}</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{s.name || '—'}</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{s.dob || '—'}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>{s.dataset_id.slice(0, 8)}…</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
