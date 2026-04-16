'use client';

import { clsx } from 'clsx';
import styles from './Badge.module.scss';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        styles.badge,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        dot && styles.hasDot,
        className,
      )}
    >
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}

// Convenience wrappers for common status patterns
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:       'success',
    deployed:     'success',
    done:         'success',
    completed:    'success',
    approved:     'success',
    processing:   'info',
    under_review: 'info',
    pending:      'warning',
    draft:        'default',
    paused:       'default',
    failed:       'error',
    deprecated:   'error',
    archived:     'outline',
  };

  const label: Record<string, string> = {
    under_review: 'In Review',
    done:         'Complete',
  };

  const v = map[status] ?? 'default';
  const text = label[status] ?? status.replace(/_/g, ' ');

  return (
    <Badge variant={v} size="sm" dot>
      {text}
    </Badge>
  );
}
