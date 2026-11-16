export type IconName =
  | 'sidebar'
  | 'plus'
  | 'close'
  | 'chevron'
  | 'map'
  | 'car'
  | 'waze'
  | 'pin'
  | 'trash'
  | 'clock'
  | 'search'
  | 'house'
  | 'fork-knife'
  | 'cup'
  | 'glass'
  | 'star';

export const ICON_NAMES: IconName[] = [
  'sidebar',
  'plus',
  'close',
  'chevron',
  'map',
  'car',
  'waze',
  'pin',
  'trash',
  'clock',
  'search',
  'house',
  'fork-knife',
  'cup',
  'glass',
  'star',
];

const PATHS: Record<IconName, string[]> = {
  sidebar: ['M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M9 4v16'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  chevron: ['M9 6l6 6-6 6'],
  map: ['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14'],
  car: ['M4 17v-5l2-5h12l2 5v5z', 'M4 12h16', 'M6 17v2', 'M18 17v2'],
  waze: [
    'M12 4a8 8 0 0 0-6.5 12.6L5 20l3.6-1A8 8 0 1 0 12 4z',
    'M9.5 14c1.5 1.2 3.5 1.2 5 0',
    'M9.5 10.5v.01',
    'M14.5 10.5v.01',
  ],
  pin: [
    'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z',
    'M12 8a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 8z',
  ],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  search: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M16 16l4.5 4.5'],
  house: ['M4 11l8-7 8 7', 'M6 10v10h12V10', 'M10 20v-5h4v5'],
  'fork-knife': ['M6 3v5a3 3 0 0 0 6 0V3', 'M9 11v10', 'M17 21V3c-2.2 1.5-3 4-3 7h3'],
  cup: ['M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M16 11h1.5a2.5 2.5 0 0 1 0 5H16', 'M8 3v2', 'M12 3v2'],
  glass: ['M4 5h16l-8 9z', 'M12 14v6', 'M8 20h8'],
  star: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z'],
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Provide only when the icon stands alone and carries meaning. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 22, label, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
