import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CellReason } from '../utils/cellFlags';

/* Floating explanation for a flagged spreadsheet cell. Rendered through a
   portal to <body> so the table's overflow:auto never clips it, and positioned
   in fixed/viewport coordinates from the hovered cell's rect. Pure presentation —
   the parent owns hover/focus state and passes the anchoring rect. */

interface Props {
  reason: CellReason;
  /** Bounding rect of the anchoring cell, in viewport coordinates. */
  rect: DOMRect;
  title: string;
  detail: string;
}

const ACCENT: Record<CellReason['flag'], string> = {
  danger: 'var(--danger)',
  warn:   'var(--warning)',
};

export function CellFlagTooltip({ reason, rect, title, detail }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // Start off-screen, then measure and place above (or below if no room) the cell.
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 8;
    const below = rect.top < height + gap + 8; // not enough room above → flip down
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = below ? rect.bottom + gap : rect.top - height - gap;
    setPos({ left, top });
  }, [rect, title, detail]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 1200,
        maxWidth: 260, pointerEvents: 'none',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: `3px solid ${ACCENT[reason.flag]}`,
        borderRadius: 8, boxShadow: 'var(--shadow-md)',
        padding: '8px 11px', fontSize: 12, lineHeight: 1.45,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontWeight: 700, color: ACCENT[reason.flag], marginBottom: 3,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: 2, flexShrink: 0,
          background: ACCENT[reason.flag], display: 'inline-block',
        }} aria-hidden />
        {title}
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>{detail}</div>
    </div>,
    document.body,
  );
}
