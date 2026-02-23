import { Check, Flame, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import type { ActivityConfig, ActivityCategory, CheckIn, CheckInStreak } from '@/types';

interface HabitCheckInListProps {
  configs: Record<string, ActivityConfig>;
  todayCheckIns: CheckIn[] | undefined;
  streaks: CheckInStreak[] | undefined;
  selectedCategory: ActivityCategory;
  onSelectCategory: (category: ActivityCategory) => void;
  onCheckIn: (category: ActivityCategory) => void;
  onUndoCheckIn: (checkInId: string) => void;
}

export function HabitCheckInList({
  configs,
  todayCheckIns,
  streaks,
  selectedCategory,
  onSelectCategory,
  onCheckIn,
  onUndoCheckIn,
}: HabitCheckInListProps) {
  const getCheckIn = (category: string) =>
    todayCheckIns?.find((c) => c.category === category);

  const getStreak = (category: string) =>
    streaks?.find((s) => s.category === category);

  const getTotalDays = (category: string) =>
    streaks?.find((s) => s.category === category)?.totalCheckIns ?? 0;

  return (
    <Card className="bg-bg-secondary border-border h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap size={20} className="text-accent" />
          Habitos Diarios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto scrollbar-thin pr-1">
        {Object.entries(configs).map(([key, config]) => {
          const checkIn = getCheckIn(key);
          const checked = !!checkIn;
          const streak = getStreak(key);
          const totalDays = getTotalDays(key);
          const isSelected = selectedCategory === key;

          return (
            <div
              key={key}
              onClick={() => onSelectCategory(key)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-accent/10 border border-accent/30'
                  : 'bg-bg-tertiary border border-border hover:border-accent/20'
              }`}
            >
              {/* Check-in button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (checked && checkIn) {
                    onUndoCheckIn(checkIn.id);
                  } else {
                    onCheckIn(key);
                  }
                }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  checked
                    ? 'border-accent bg-accent hover:bg-accent/80'
                    : 'border-gray-500 hover:border-accent'
                }`}
              >
                {checked && <Check size={16} className="text-white" />}
              </button>

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${config.color}20`,
                  color: config.color,
                }}
              >
                <ActivityIcon icon={config.icon} size={20} />
              </div>

              {/* Name and stats */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium truncate ${
                    checked ? 'text-gray-400' : 'text-white'
                  }`}
                >
                  {config.name}
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-accent flex items-center gap-1">
                    <Zap size={12} />
                    {totalDays} Dias
                  </span>
                  {(streak?.currentStreak ?? 0) > 0 && (
                    <span className="text-orange-400 flex items-center gap-1">
                      <Flame size={12} />
                      {streak?.currentStreak} Dia{(streak?.currentStreak ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                  {(streak?.currentStreak ?? 0) === 0 && (
                    <span className="text-gray-500 flex items-center gap-1">
                      <Flame size={12} />
                      0 Dia
                    </span>
                  )}
                </div>
              </div>

              {/* Check indicator for selected */}
              {checked && (
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
