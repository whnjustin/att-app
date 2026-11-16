import { Children, useId, type ReactNode } from 'react';
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
  chevron?: boolean;
  onClick?: () => void;
  /** When defined the row is expandable and reports aria-expanded. */
  expanded?: boolean;
  expandedContent?: ReactNode;
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  onClick,
  expanded,
  expandedContent,
}: ListRowProps) {
  const interactive = !!onClick;
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
  return (
    <li className="list-row">
      {interactive ? (
        <button type="button" className="row-main row-button" onClick={onClick} aria-expanded={expanded}>
          {body}
        </button>
      ) : (
        <div className="row-main">{body}</div>
      )}
      {expanded && expandedContent ? <div className="row-expanded">{expandedContent}</div> : null}
    </li>
  );
}
