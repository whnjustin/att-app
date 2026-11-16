import type { ElementType, HTMLAttributes } from 'react';

export interface GlassProps extends HTMLAttributes<HTMLElement> {
  variant?: 'regular' | 'strong';
  as?: ElementType;
}

/** Surface wrapper for the floating navigation and control layer only. */
export function Glass({ variant = 'regular', as: Tag = 'div', className, ...rest }: GlassProps) {
  const cls = ['glass', variant === 'strong' ? 'glass-strong' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <Tag className={cls} {...rest} />;
}
