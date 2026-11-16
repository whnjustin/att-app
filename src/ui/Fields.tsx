import { useId, type InputHTMLAttributes } from 'react';
import { TRIP_DAYS } from '../contracts/types';
import { formatDay, formatMin } from '../lib/time';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, value, onChange, className, id, ...rest }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field-label" htmlFor={fid}>
        {label}
      </label>
      <input
        id={fid}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

export function SearchField({ value, onChange, ariaLabel, placeholder = 'Search' }: SearchFieldProps) {
  return (
    <div className="search-field">
      <Icon name="search" size={18} />
      <input
        type="search"
        className="search-input"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value ? (
        <IconButton icon="close" iconSize={16} aria-label="Clear" onClick={() => onChange('')} />
      ) : null}
    </div>
  );
}

export interface TimeFieldProps {
  /** Minutes from midnight. */
  value: number;
  onChange: (min: number) => void;
  label: string;
  /** Default 0. */
  min?: number;
  /** Default 1410. */
  max?: number;
}

/** 30 minute steps. A native select sits invisibly over the formatted value for the platform picker. */
export function TimeField({ value, onChange, label, min = 0, max = 1410 }: TimeFieldProps) {
  const id = useId();
  const options: number[] = [];
  for (let m = Math.ceil(min / 30) * 30; m <= max; m += 30) options.push(m);
  if (!options.includes(value)) options.push(value);
  options.sort((a, b) => a - b);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="pick">
        <span className="pick-value">{formatMin(value)}</span>
        <Icon name="clock" size={18} />
        <select
          id={id}
          className="pick-native"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {formatMin(m)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export interface DayFieldProps {
  /** 'YYYY-MM-DD' or null. */
  value: string | null;
  onChange: (date: string | null) => void;
  label: string;
}

export function DayField({ value, onChange, label }: DayFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={`${id}-l`}>
        {label}
      </span>
      <SegmentedControl
        ariaLabel={label}
        value={value && (TRIP_DAYS as string[]).includes(value) ? value : null}
        onChange={onChange}
        options={TRIP_DAYS.map((d) => ({ value: d as string, label: formatDay(d) }))}
      />
      <input
        type="date"
        className="field-input"
        aria-label={`${label} date`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}
