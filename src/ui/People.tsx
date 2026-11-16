export interface AvatarProps {
  initials: string;
  /** CSS custom property name, e.g. '--person-ayyad'. */
  colorToken: string;
  size?: number;
  label: string;
}

export function Avatar({ initials, colorToken, size = 32, label }: AvatarProps) {
  return (
    <span
      className="avatar"
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        background: `var(${colorToken})`,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials}
    </span>
  );
}

export interface AvatarStackProps {
  people: Omit<AvatarProps, 'size'>[];
  max?: number;
  size?: number;
}

export function AvatarStack({ people, max = 4, size = 28 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((p) => (
        <Avatar key={p.label} {...p} size={size} />
      ))}
      {extra > 0 ? (
        <span
          className="avatar avatar-more"
          role="img"
          aria-label={`${extra} more`}
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

export interface BadgeProps {
  n: number;
  /** CSS custom property name, e.g. '--leg-1'. */
  colorVar: string;
}

const DARK_TEXT = new Set(['--leg-6', '--leg-7']);

export function Badge({ n, colorVar }: BadgeProps) {
  return (
    <span
      className="badge"
      style={{ background: `var(${colorVar})`, color: DARK_TEXT.has(colorVar) ? '#000' : '#fff' }}
    >
      {n}
    </span>
  );
}
