import { useEffect, useRef, useState } from 'react';
import { Icon, IconButton } from '../../ui';
import { navigate } from '../../lib/router';

type Page = 'overview' | 'plan';

const TARGETS: { page: Page; label: string }[] = [
  { page: 'overview', label: 'Overview' },
  { page: 'plan', label: 'Day plan' },
];

export function NavButton({ page }: { page: Page }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('hashchange', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('hashchange', close);
    };
  }, [open]);

  const go = (target: Page) => {
    setOpen(false);
    if (target !== page) navigate(target === 'plan' ? { page: 'plan', date: null } : { page: 'overview' });
  };

  return (
    <div className="shell-nav" ref={wrap}>
      {open ? (
        <div className="shell-pop glass glass-strong" role="menu" aria-label="Pages">
          {TARGETS.map((t) => (
            <button
              key={t.page}
              type="button"
              role="menuitemradio"
              aria-checked={t.page === page}
              className="shell-pop-item"
              onClick={() => go(t.page)}
            >
              <span>{t.label}</span>
              {t.page === page ? <Icon name="check" size={18} className="shell-check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      <IconButton
        glass
        icon="layers"
        aria-label="Pages"
        aria-haspopup="menu"
        aria-expanded={open}
        className="shell-fab"
        onClick={() => setOpen((o) => !o)}
      />
    </div>
  );
}
