import { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getStoredQuestColors, type QuestCategoryColors } from '@/utils/theme';
import type { Quest } from '@/types';

interface QuestCalendarViewProps {
  monthQuests: Quest[] | undefined;
  selectedDate: string;
  selectedDateQuests: Quest[] | undefined;
  currentMonth: { year: number; month: number };
  onDateSelect: (date: string) => void;
  onMonthChange: (month: { year: number; month: number }) => void;
  onCreateQuest: (date: string) => void;
  onCompleteQuest: (questId: string) => void;
  onEditQuest: (quest: Quest) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

export function QuestCalendarView({
  monthQuests,
  selectedDate,
  selectedDateQuests,
  currentMonth,
  onDateSelect,
  onMonthChange,
  onCreateQuest,
  onCompleteQuest,
  onEditQuest,
}: QuestCalendarViewProps) {
  // Quest colors from settings
  const [questColors, setQuestColors] = useState<QuestCategoryColors>(getStoredQuestColors);

  useEffect(() => {
    const handleStorageChange = () => {
      setQuestColors(getStoredQuestColors());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  // Group quests by date
  const questsByDate = useMemo(() => {
    const map = new Map<string, Quest[]>();
    monthQuests?.forEach((quest) => {
      const date = quest.scheduledDate;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(quest);
    });
    return map;
  }, [monthQuests]);

  const daysInMonth = new Date(
    currentMonth.year,
    currentMonth.month,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    currentMonth.year,
    currentMonth.month - 1,
    1
  ).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth.month === today.getMonth() + 1 &&
    currentMonth.year === today.getFullYear();

  const isSelected = (day: number) => {
    const dateStr = `${currentMonth.year}-${String(currentMonth.month).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  const getDateString = (day: number) =>
    `${currentMonth.year}-${String(currentMonth.month).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`;

  const goToPrevMonth = () => {
    if (currentMonth.month === 1) {
      onMonthChange({ year: currentMonth.year - 1, month: 12 });
    } else {
      onMonthChange({ ...currentMonth, month: currentMonth.month - 1 });
    }
  };

  const goToNextMonth = () => {
    if (currentMonth.month === 12) {
      onMonthChange({ year: currentMonth.year + 1, month: 1 });
    } else {
      onMonthChange({ ...currentMonth, month: currentMonth.month + 1 });
    }
  };

  // Calculate weeks for rendering
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    currentWeek.push(null);
  }

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Format selected date for display
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const selectedDateDisplay = selectedDateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Calendar - 2 columns */}
      <div className="xl:col-span-2 min-h-0">
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <button
                onClick={goToPrevMonth}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-400" />
              </button>
              <CardTitle className="text-center capitalize">
                {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
              </CardTitle>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={i}
                  className="text-center text-xs text-gray-500 py-2 font-medium"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map((day, dayIndex) => {
                    if (day === null) {
                      return (
                        <div
                          key={dayIndex}
                          className="min-h-[80px] bg-bg-tertiary/30 rounded-lg"
                        />
                      );
                    }

                    const dateStr = getDateString(day);
                    const dayQuests = questsByDate.get(dateStr) || [];
                    const todayClass = isToday(day);
                    const selectedClass = isSelected(day);

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => onDateSelect(dateStr)}
                        className={`min-h-[80px] p-1.5 rounded-lg cursor-pointer transition-all ${
                          selectedClass
                            ? 'bg-accent/20 border-2 border-accent'
                            : todayClass
                            ? 'bg-bg-tertiary border border-accent/50'
                            : 'bg-bg-tertiary border border-transparent hover:border-accent/30'
                        }`}
                      >
                        {/* Day number */}
                        <div
                          className={`text-xs font-medium mb-1 ${
                            todayClass
                              ? 'text-accent'
                              : selectedClass
                              ? 'text-white'
                              : 'text-gray-400'
                          }`}
                        >
                          {day}
                        </div>

                        {/* Quest blocks */}
                        <div className="space-y-0.5">
                          {dayQuests.slice(0, 3).map((quest) => (
                            <div
                              key={quest.id}
                              className={`text-sm px-1.5 py-0.5 rounded truncate text-white font-medium ${
                                quest.status === 'completed'
                                  ? 'opacity-50 line-through'
                                  : ''
                              }`}
                              style={{
                                backgroundColor: questColors[quest.category],
                              }}
                              title={quest.title}
                            >
                              {quest.title}
                            </div>
                          ))}
                          {dayQuests.length > 3 && (
                            <div className="text-xs text-gray-500 px-1">
                              +{dayQuests.length - 3} mais
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: questColors.daily }}
                />
                Daily
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: questColors.main }}
                />
                Main
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: questColors.side }}
                />
                Side
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected day quests - 1 column */}
      <div className="xl:col-span-1 min-h-0">
        <Card className="bg-bg-secondary border-border h-full">
          <CardHeader>
            <div className="flex-1">
              <CardTitle className="text-base capitalize">
                {selectedDateDisplay}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                {selectedDateQuests?.length ?? 0} quest
                {(selectedDateQuests?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onCreateQuest(selectedDate)}
              className="flex items-center gap-1"
            >
              <Plus size={14} />
              Nova
            </Button>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
            {selectedDateQuests && selectedDateQuests.length > 0 ? (
              <div className="space-y-2">
                {[...selectedDateQuests]
                  .sort((a, b) => {
                    // Pending first, completed last
                    if (a.status === 'completed' && b.status !== 'completed') return 1;
                    if (a.status !== 'completed' && b.status === 'completed') return -1;
                    return 0;
                  })
                  .map((quest) => (
                  <div
                    key={quest.id}
                    className={`p-3 rounded-lg border transition-all ${
                      quest.status === 'completed'
                        ? 'bg-bg-tertiary/50 border-border opacity-60'
                        : 'bg-bg-tertiary border-border hover:border-accent/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Complete button */}
                      <button
                        onClick={() => onCompleteQuest(quest.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          quest.status === 'completed'
                            ? 'border-accent bg-accent hover:bg-accent/80'
                            : 'border-gray-500 hover:border-accent'
                        }`}
                      >
                        {quest.status === 'completed' && (
                          <Check size={14} className="text-white" />
                        )}
                      </button>

                      {/* Quest info */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onEditQuest(quest)}
                      >
                        <p
                          className={`font-medium text-base ${
                            quest.status === 'completed'
                              ? 'text-gray-500 line-through'
                              : 'text-white'
                          }`}
                        >
                          {quest.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor:
                                questColors[quest.category] + '20',
                              color: questColors[quest.category],
                            }}
                          >
                            {quest.category}
                          </span>
                          {quest.estimatedDuration && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} />
                              {formatDuration(quest.estimatedDuration)}
                            </span>
                          )}
                          <span className="text-xs text-accent">
                            +{quest.xpReward} XP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-4">
                  Nenhuma quest para este dia
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onCreateQuest(selectedDate)}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar Quest
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
