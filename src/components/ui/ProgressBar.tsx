import { cn } from '@/utils/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showValue?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'bg-accent',
  showValue = false,
  label,
  className,
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium text-white">
              {value.toLocaleString()} / {max.toLocaleString()}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-bg-tertiary rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            color,
            animated && 'animate-pulse-glow'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export interface XPProgressBarProps {
  currentXP: number;
  requiredXP: number;
  level: number;
  className?: string;
}

export function XPProgressBar({ currentXP, requiredXP, level, className }: XPProgressBarProps) {
  const percentage = Math.min((currentXP / requiredXP) * 100, 100);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">Level {level}</span>
        <span className="text-xs text-accent font-medium">
          {currentXP.toLocaleString()} / {requiredXP.toLocaleString()} XP
        </span>
      </div>
      <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-blue-400 transition-all duration-500 shadow-glow-sm"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
