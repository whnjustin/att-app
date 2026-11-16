import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  /** null shows no selection. */
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);
  const tabStop = index >= 0 ? index : 0;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = options.length;
    let next = -1;
    const cur = index >= 0 ? index : 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`segmented glass ${className ?? ''}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      onKeyDown={onKey}
    >
      {index >= 0 ? (
        <span
          className="seg-thumb"
          aria-hidden="true"
          style={{
            width: `calc((100% - 8px) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      ) : null}
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === tabStop ? 0 : -1}
          className="seg-option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
