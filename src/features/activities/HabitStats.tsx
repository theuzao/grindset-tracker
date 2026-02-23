import { Calendar, Zap, BarChart3, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CheckInStreak } from '@/types';

interface HabitStatsProps {
  streak: CheckInStreak | undefined;
  monthlyCheckIns: number;
  daysInMonth: number;
}

export function HabitStats({
  streak,
  monthlyCheckIns,
  daysInMonth,
}: HabitStatsProps) {
  const today = new Date();
  const daysPassed = Math.min(today.getDate(), daysInMonth);
  const monthlyRate =
    daysPassed > 0 ? Math.round((monthlyCheckIns / daysPassed) * 100) : 0;

  return (
    <Card className="bg-bg-secondary border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={20} className="text-accent" />
          Estatisticas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Monthly Records */}
          <div className="p-4 bg-bg-tertiary rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-green-400" />
              <span className="text-xs text-gray-400">Registros mensais</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {monthlyCheckIns}
              <span className="text-sm font-normal text-gray-500 ml-1">
                Dias
              </span>
            </p>
          </div>

          {/* Total Check-ins */}
          <div className="p-4 bg-bg-tertiary rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-accent" />
              <span className="text-xs text-gray-400">Check-ins Totais</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {streak?.totalCheckIns ?? 0}
              <span className="text-sm font-normal text-gray-500 ml-1">
                Dias
              </span>
            </p>
          </div>

          {/* Monthly Rate */}
          <div className="p-4 bg-bg-tertiary rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-400">Taxa de check-in mensal</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {monthlyRate}
              <span className="text-sm font-normal text-gray-500 ml-1">%</span>
            </p>
          </div>

          {/* Current Streak */}
          <div className="p-4 bg-bg-tertiary rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} className="text-orange-400" />
              <span className="text-xs text-gray-400">Faixa Atual</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame
                size={24}
                className={
                  (streak?.currentStreak ?? 0) > 0
                    ? 'text-orange-400'
                    : 'text-gray-600'
                }
              />
              <p className="text-2xl font-bold text-white">
                {streak?.currentStreak ?? 0}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  Dias
                </span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
