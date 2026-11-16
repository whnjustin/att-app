import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from './useDialog';

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible name for the dialog. */
  label?: string;
}

export function Sidebar({ open, onClose, children, label = 'Menu' }: SidebarProps) {
  if (!open) return null;
  return (
    <SidebarInner onClose={onClose} label={label}>
      {children}
    </SidebarInner>
  );
}

function SidebarInner({ onClose, children, label }: Omit<SidebarProps, 'open'> & { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  useDialog(true, ref, onClose);

  const down = (e: PointerEvent<HTMLElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    if (Math.abs(mx) > Math.abs(e.clientY - s.y) && mx < 0) setDx(mx);
  };
  const up = () => {
    const closing = dx < -80;
    start.current = null;
    setDx(0);
    if (closing) onClose();
  };

  return createPortal(
    <div className="sidebar-root">
      <div className="scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`sidebar glass glass-strong${dx ? ' dragging' : ''}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
