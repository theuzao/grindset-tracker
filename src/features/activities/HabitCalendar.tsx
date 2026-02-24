import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface HabitCalendarProps {
  checkInDays: number[] | undefined;
  currentMonth: { year: number; month: number };
  onMonthChange: (month: { year: number; month: number }) => void;
  onDayToggle?: (date: string, isChecked: boolean) => void;
  isLoading?: boolean;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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

export function HabitCalendar({
  checkInDays,
  currentMonth,
  onMonthChange,
  onDayToggle,
  isLoading,
}: HabitCalendarProps) {
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
  const isCheckedIn = (day: number) => checkInDays?.includes(day) ?? false;

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth.month === today.getMonth() + 1 &&
    currentMonth.year === today.getFullYear();

  // Check if a day is in the future (blocked)
  const isFuture = (day: number) => {
    const dayDate = new Date(currentMonth.year, currentMonth.month - 1, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dayDate > todayStart;
  };

  // Get date string for a day
  const getDateString = (day: number) => {
    const month = String(currentMonth.month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${currentMonth.year}-${month}-${dayStr}`;
  };

  // Handle day click
  const handleDayClick = (day: number) => {
    if (isFuture(day) || !onDayToggle || isLoading) return;
    const dateStr = getDateString(day);
    const checked = isCheckedIn(day);
    onDayToggle(dateStr, checked);
  };

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

  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    currentWeek.push(null);
  }

  // Add days of the month
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Add empty cells for remaining days
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return (
    <Card className="bg-bg-secondary border-border">
      <CardHeader className="py-5">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={goToPrevMonth}
            className="p-2.5 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <CardTitle className="text-center text-lg capitalize">
            {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
          </CardTitle>
          <button
            onClick={goToNextMonth}
            className="p-2.5 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <ChevronRight size={24} className="text-gray-400" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-6 px-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {WEEKDAYS.map((day, i) => (
            <div
              key={i}
              className="text-center text-sm text-gray-500 py-2 font-medium"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid - circles style */}
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => {
                if (day === null) {
                  return <div key={dayIndex} className="h-16" />;
                }

                const checked = isCheckedIn(day);
                const todayClass = isToday(day);

                const future = isFuture(day);
                const canClick = !future && onDayToggle;

                return (
                  <div
                    key={dayIndex}
                    className="h-16 flex flex-col items-center justify-center"
                  >
                    {/* Day number */}
                    <span
                      className={`text-sm mb-2 ${
                        future
                          ? 'text-gray-600'
                          : todayClass
                          ? 'text-blue-500 font-bold'
                          : 'text-blue-500'
                      }`}
                    >
                      {day}
                    </span>
                    {/* Circle indicator */}
                    <button
                      onClick={() => handleDayClick(day)}
                      disabled={future || isLoading || !onDayToggle}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        checked
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : future
                          ? 'bg-gray-800/30 border border-gray-700 cursor-not-allowed'
                          : 'bg-gray-700/50 border border-gray-600 hover:border-blue-400 hover:bg-gray-600/50'
                      } ${canClick ? 'cursor-pointer' : ''}`}
                    >
                      {checked && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
