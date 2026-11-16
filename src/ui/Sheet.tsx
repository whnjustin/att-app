import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { useDialog } from './useDialog';

export type SheetDetent = 'medium' | 'large';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  detent?: SheetDetent;
  children: ReactNode;
  /** Header controls placed before the close button. */
  actions?: ReactNode;
}

const isWide = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 768px)').matches;

/** Bottom sheet under 768px, centred modal at 768px and wider. */
export function Sheet({ open, onClose, title, detent = 'medium', children, actions }: SheetProps) {
  if (!open) return null;
  return (
    <SheetInner onClose={onClose} title={title} detent={detent} actions={actions}>
      {children}
    </SheetInner>
  );
}

function SheetInner({
  onClose,
  title,
  detent: initial,
  children,
  actions,
}: Omit<SheetProps, 'open'> & { detent: SheetDetent }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [detent, setDetent] = useState<SheetDetent>(initial);
  const [dy, setDy] = useState<number | null>(null);
  const drag = useRef<{ y: number; t: number } | null>(null);
  useDialog(true, ref, onClose);

  const down = (e: PointerEvent<HTMLElement>) => {
    if (isWide() || (e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: e.timeStamp };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDy(0);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setDy(e.clientY - drag.current.y);
  };
  const up = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const delta = e.clientY - d.y;
    const v = delta / Math.max(1, e.timeStamp - d.t);
    setDy(null);
    if (delta < -50 || v < -0.5) setDetent('large');
    else if (delta > 100 || v > 0.6) {
      if (detent === 'large' && delta <= 220 && v <= 1.2) setDetent('medium');
      else onClose();
    }
  };

  return createPortal(
    <div className="sheet-root">
      <div className="scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet glass glass-strong sheet-${detent}${dy !== null ? ' dragging' : ''}`}
        style={dy !== null && dy > 0 ? { transform: `translateY(${dy}px)` } : undefined}
      >
        <div
          className="sheet-grab"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-head">
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
            <div className="sheet-actions">
              {actions}
              <IconButton icon="close" aria-label="Close" onClick={onClose} />
            </div>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
