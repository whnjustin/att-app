import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'destructive';
export type ButtonSize = 'regular' | 'small';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: IconName;
  children: ReactNode;
}

export function Button({
  variant = 'filled',
  size = 'regular',
  leading,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className ?? ''}`} {...rest}>
      {leading ? <Icon name={leading} size={size === 'small' ? 16 : 18} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  icon: IconName;
  'aria-label': string;
  variant?: ButtonVariant;
  /** Floating glass circle for the control layer. */
  glass?: boolean;
  iconSize?: number;
}

export function IconButton({
  icon,
  variant = 'plain',
  glass = false,
  iconSize = 22,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = `btn btn-icon btn-${variant} ${glass ? 'glass btn-glass' : ''} ${className ?? ''}`;
  return (
    <button type={type} className={cls} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
