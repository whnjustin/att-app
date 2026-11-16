import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface TopBarProps {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Render the large title below the bar; it collapses into the bar title on scroll. Default true. */
  large?: boolean;
}

/**
 * Sticky glass bar. Renders a fragment: the bar, then (when `large`) the large title.
 * Place it directly inside the page wrapper, before the content column.
 */
export function TopBar({ title, leading, trailing, large = true }: TopBarProps) {
  const barRef = useRef<HTMLElement>(null);
  const largeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const target = largeRef.current;
    const bar = barRef.current;
    if (!large || !target || !bar || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`,
    });
    io.observe(target);
    return () => io.disconnect();
  }, [large]);

  const showBarTitle = !large || collapsed;
  return (
    <>
      <header ref={barRef} className="topbar glass">
        <div className="topbar-inner">
          <div className="topbar-slot topbar-lead">{leading}</div>
          <div
            className={`topbar-title${showBarTitle ? ' shown' : ''}`}
            aria-hidden={!showBarTitle || undefined}
          >
            {title}
          </div>
          <div className="topbar-slot topbar-trail">{trailing}</div>
        </div>
      </header>
      {large ? (
        <div ref={largeRef} className="large-title-wrap">
          <h1 className="large-title">{title}</h1>
        </div>
      ) : null}
    </>
  );
}
