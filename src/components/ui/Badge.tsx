import { cn } from '@/utils/cn';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-bg-tertiary text-gray-300 border-border',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export interface DifficultyBadgeProps {
  difficulty: 'easy' | 'medium' | 'hard';
  className?: string;
}

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const config = {
    easy: { label: 'Fácil', variant: 'success' as const },
    medium: { label: 'Médio', variant: 'warning' as const },
    hard: { label: 'Difícil', variant: 'danger' as const },
  };

  const { label, variant } = config[difficulty];

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  );
}

export interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <Badge variant="accent" className={cn('gap-1', className)}>
      <span className="text-base">🔥</span>
      <span>{streak}</span>
    </Badge>
  );
}
