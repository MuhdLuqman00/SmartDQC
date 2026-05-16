import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch {
      setError(t('Invalid username or password.', 'Nama pengguna atau kata laluan tidak sah.'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)',
    color: 'var(--text-primary)',
    fontSize: 14, outline: 'none',
    transition: 'border-color var(--transition)',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--surface)' }}>

      {/* ── LEFT — Brand panel ─────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 44%',
        background: 'var(--kkm-deep)',
        color: '#fff',
        padding: '48px 56px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Top: ministry mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700, fontSize: 18, color: '#fff',
          }}>S</div>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              marginBottom: 2,
            }}>
              {t('Ministry of Health Malaysia', 'Kementerian Kesihatan Malaysia')}
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700, fontSize: 16, color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              SmartDQC
            </div>
          </div>
        </div>

        {/* Middle: tagline */}
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700, fontSize: 32, lineHeight: 1.25,
            margin: 0, marginBottom: 18,
            letterSpacing: '-0.015em',
          }}>
            {t(
              'Data Quality & Analytics Platform',
              'Platform Kualiti Data & Analitik',
            )}
          </h1>
          <p style={{
            fontSize: 14, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 420, margin: 0,
          }}>
            {t(
              'Secure data validation, quality assurance, and reporting platform for the Ministry of Health Malaysia.',
              'Platform pengesahan data, jaminan kualiti, dan pelaporan selamat untuk Kementerian Kesihatan Malaysia.',
            )}
          </p>
        </div>

        {/* Bottom: footer */}
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 18,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>© {new Date().getFullYear()} Kementerian Kesihatan Malaysia</span>
          <span>v2.0</span>
        </div>
      </div>

      {/* ── RIGHT — Form panel ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700, fontSize: 24,
            color: 'var(--text-primary)',
            margin: 0, marginBottom: 8,
            letterSpacing: '-0.01em',
          }}>
            {t('Sign In', 'Log Masuk')}
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-secondary)',
            margin: 0, marginBottom: 28,
          }}>
            {t(
              'Enter your credentials to access the system.',
              'Masukkan maklumat akaun anda untuk akses sistem.',
            )}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: 6,
              }}>
                {t('Username', 'Nama Pengguna')}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('Enter username', 'Masukkan nama pengguna')}
                required
                autoComplete="username"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--kkm-blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: 6,
              }}>
                {t('Password', 'Kata Laluan')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--kkm-blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-btn)',
                padding: '10px 14px',
                color: 'var(--danger)', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                background: loading ? 'rgba(0,114,188,0.7)' : 'var(--kkm-blue)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius-btn)',
                padding: '12px 16px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600, fontSize: 14,
                letterSpacing: '0.01em',
                transition: 'background var(--transition)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? t('Signing in…', 'Sedang log masuk…')
                : t('Sign In', 'Log Masuk')}
            </button>
          </form>

          <div style={{
            marginTop: 28, paddingTop: 18,
            borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)',
            textAlign: 'center', letterSpacing: '0.02em',
          }}>
            {t('Authorised users only.', 'Pengguna yang sah sahaja.')}
          </div>
        </div>
      </div>
    </div>
  );
}
