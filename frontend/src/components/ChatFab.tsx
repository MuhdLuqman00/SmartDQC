import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function ChatFab(): JSX.Element {
  const [hovered, setHovered] = useState<boolean>(false);
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/ai')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Buka AI Chatbot"
      style={{
        position: 'fixed', bottom: 28, right: 28,
        width: 48, height: 48, borderRadius: '50%',
        background: hovered ? 'var(--navy-mid)' : 'var(--navy)',
        color: '#fff', border: 'none', fontSize: 20,
        boxShadow: '0 4px 16px rgba(27,42,74,0.25)',
        zIndex: 100, transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      ✧
    </button>
  );
}
