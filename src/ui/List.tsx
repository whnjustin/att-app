import { Children, useEffect, useId, useState, type ReactNode, type TransitionEvent } from 'react';
import { Icon } from './Icon';

export interface ListGroupProps {
  title?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function ListGroup({ title, headerAction, children }: ListGroupProps) {
  const id = useId();
  return (
    <section className="list-group">
      {title || headerAction ? (
        <div className="list-head">
          {title ? (
            <h2 id={id} className="list-title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {headerAction}
        </div>
      ) : null}
      <ul className="list" aria-labelledby={title ? id : undefined}>
        {Children.toArray(children)}
      </ul>
    </section>
  );
}

export interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** A separate control after the row, outside the row button (avoids nested buttons). */
  action?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  /** When defined the row is expandable and reports aria-expanded. */
  expanded?: boolean;
  expandedContent?: ReactNode;
  /** DOM id on the row, for scrolling to it. */
  id?: string;
}

const CLOSE_FALLBACK_MS = 450;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Keeps content mounted while a height and opacity transition runs, then unmounts it. */
function useExpand(expanded: boolean) {
  const [mounted, setMounted] = useState(expanded);
  const [open, setOpen] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setMounted(true);
      if (prefersReducedMotion()) {
        setOpen(true);
        return;
      }
      let b = 0;
      const a = requestAnimationFrame(() => {
        b = requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        cancelAnimationFrame(a);
        cancelAnimationFrame(b);
      };
    }
    setOpen(false);
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    const t = setTimeout(() => setMounted(false), CLOSE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [expanded]);

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !expanded) setMounted(false);
  };
  return { mounted, open, onTransitionEnd };
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  action,
  chevron,
  onClick,
  expanded,
  expandedContent,
  id,
}: ListRowProps) {
  const interactive = !!onClick;
  const expand = useExpand(!!expanded && !!expandedContent);
  const body = (
    <>
      {leading ? <span className="row-leading">{leading}</span> : null}
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle ? <span className="row-sub">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="row-trailing">{trailing}</span> : null}
      {chevron || expanded !== undefined ? (
        <Icon name="chevron" size={16} className={`row-chevron${expanded ? ' open' : ''}`} />
      ) : null}
    </>
  );
  const main = interactive ? (
    <button type="button" className="row-main row-button" onClick={onClick} aria-expanded={expanded}>
      {body}
    </button>
  ) : (
    <div className="row-main">{body}</div>
  );
  return (
    <li className="list-row" id={id}>
      {action ? (
        <div className="row-line">
          {main}
          <span className="row-action">{action}</span>
        </div>
      ) : (
        main
      )}
      {expand.mounted && expandedContent ? (
        <div className={`row-expand${expand.open ? ' open' : ''}`} onTransitionEnd={expand.onTransitionEnd}>
          <div className="row-expand-inner">
            <div className="row-expanded">{expandedContent}</div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
