import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { ChatFab } from './ChatFab';

interface Props { username?: string; role?: string; onLogout: () => void; }

const PAGE_META: Record<string, [string, string]> = {
  '/':         ['Papan Pemuka',     'Gambaran keseluruhan sistem'],
  '/upload':   ['Muat Naik Dataset','Ingest fail CSV atau Excel'],
  '/explorer': ['Penjelajah Data',  'Semak dan analisis data mentah'],
  '/quality':  ['Semakan Kualiti',  'Skor kelengkapan dan anomali'],
  '/cleaning': ['Pembersihan Data', 'Semak tindakan pembersihan automatik'],
  '/ai':       ['Analisis Pintar',  'Tanya soalan dalam bahasa semula jadi'],
  '/geo':      ['Peta Geo',         'Peta choropleth dan ramalan daerah'],
  '/reports':  ['Jana Laporan',     'Eksport PDF atau PPTX berjenama KKM'],
  '/datasets': ['Perpustakaan',     'Bandingkan dataset dan paut rekod'],
  '/history':  ['Sejarah Sesi',     'Semak semula sesi pembersihan lepas'],
  '/settings': ['Tetapan',          'Ambang kualiti dan peraturan pembersihan'],
  '/audit':    ['Log Audit',        'Sejarah tindakan sistem'],
};

export function Layout({ username: _username, role, onLogout }: Props): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const location = useLocation();

  const match = Object.entries(PAGE_META).find(([p]) =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  );
  const [title, subtitle] = match ? match[1] : ['SmartDQC', ''];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar role={role} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNav title={title} subtitle={subtitle} onLogout={onLogout} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: 24 }}>
          <Outlet />
        </main>
      </div>
      <ChatFab />
    </div>
  );
}
