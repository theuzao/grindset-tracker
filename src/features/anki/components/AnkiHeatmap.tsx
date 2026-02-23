import { useState, useEffect, useMemo } from 'react';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { cn } from '@/utils/cn';

interface HeatmapData {
  date: string;
  count: number;
}

const WEEKS_TO_SHOW = 13; // ~3 months

function getIntensityClass(count: number, maxCount: number): string {
  if (count === 0) return 'bg-bg-tertiary';
  const ratio = count / Math.max(maxCount, 1);
  if (ratio >= 0.75) return 'bg-accent';
  if (ratio >= 0.5) return 'bg-accent/70';
  if (ratio >= 0.25) return 'bg-accent/40';
  return 'bg-accent/20';
}

export function AnkiHeatmap() {
  const [data, setData] = useState<HeatmapData[]>([]);

  useEffect(() => {
    ankiRepository.getHeatmapData(4).then(setData);
  }, []);

  const { grid, maxCount } = useMemo(() => {
    const dataMap: Record<string, number> = {};
    let max = 0;
    for (const d of data) {
      dataMap[d.date] = d.count;
      if (d.count > max) max = d.count;
    }

    const today = new Date();
    const todayDay = today.getDay();
    const totalDays = WEEKS_TO_SHOW * 7 - (6 - todayDay);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    const weeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];

    const startDay = startDate.getDay();
    for (let i = 0; i < startDay; i++) {
      currentWeek.push({ date: '', count: -1 });
    }

    const cursor = new Date(startDate);
    for (let i = 0; i < totalDays; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      currentWeek.push({ date: dateStr, count: dataMap[dateStr] || 0 });

      if (cursor.getDay() === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { grid: weeks, maxCount: max };
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Grid - each column is a week, each row is a day */}
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${grid.length}, 1fr)` }}
      >
        {grid.map((week, wi) =>
          // Each week renders 7 rows (days)
          week.map((cell, di) => (
            <div
              key={`${wi}-${di}`}
              className={cn(
                'aspect-square rounded-[2px]',
                cell.count < 0
                  ? 'bg-transparent'
                  : getIntensityClass(cell.count, maxCount),
              )}
              style={{ gridColumn: wi + 1, gridRow: di + 1 }}
              title={cell.date ? `${cell.date}: ${cell.count} cards` : ''}
            />
          )),
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-[2px] bg-bg-tertiary" />
        <div className="w-3 h-3 rounded-[2px] bg-accent/20" />
        <div className="w-3 h-3 rounded-[2px] bg-accent/40" />
        <div className="w-3 h-3 rounded-[2px] bg-accent/70" />
        <div className="w-3 h-3 rounded-[2px] bg-accent" />
        <span>Mais</span>
      </div>
    </div>
  );
}
