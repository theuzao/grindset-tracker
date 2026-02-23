import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import {
  useTodayCheckIns,
  useAllCheckInStreaks,
  useMonthlyCheckIns,
  useCustomCategories,
} from '@/database/hooks';
import { ACTIVITY_CONFIGS } from '@/features/gamification/constants';
import { checkInRepository } from '@/database/repositories/checkInRepository';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { HabitCheckInList } from '@/features/activities/HabitCheckInList';
import { HabitCalendar } from '@/features/activities/HabitCalendar';
import { HabitStats } from '@/features/activities/HabitStats';
import type { ActivityCategory, ActivityConfig } from '@/types';

export function Activities() {
  const todayCheckIns = useTodayCheckIns();
  const allStreaks = useAllCheckInStreaks();
  const customCategories = useCustomCategories(true);
  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(
    ACTIVITY_CONFIGS
  );
  const [selectedCategory, setSelectedCategory] =
    useState<ActivityCategory>('study');
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Carregar todas as configs (padrao + customizadas)
  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  // Buscar check-ins do mes para a categoria selecionada
  const monthlyCheckIns = useMonthlyCheckIns(
    selectedCategory,
    currentMonth.year,
    currentMonth.month
  );

  // Calcular dias no mes atual
  const daysInMonth = new Date(
    currentMonth.year,
    currentMonth.month,
    0
  ).getDate();

  // Handler para fazer check-in
  const handleCheckIn = async (category: ActivityCategory) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await checkInRepository.checkIn(category);
      console.log('Check-in realizado:', result);
    } catch (error) {
      console.error('Erro ao fazer check-in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para desfazer check-in
  const handleUndoCheckIn = async (checkInId: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await checkInRepository.undoCheckIn(checkInId);
      console.log('Check-in desfeito');
    } catch (error) {
      console.error('Erro ao desfazer check-in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para toggle de dia no calendário
  const handleDayToggle = async (date: string, isChecked: boolean) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isChecked) {
        // Desfazer check-in
        await checkInRepository.undoCheckInByDate(selectedCategory, date);
        console.log('Check-in desfeito para:', date);
      } else {
        // Fazer check-in para a data
        await checkInRepository.checkInForDate(selectedCategory, date);
        console.log('Check-in realizado para:', date);
      }
    } catch (error) {
      console.error('Erro ao toggle check-in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Selecionar categoria
  const handleSelectCategory = (category: ActivityCategory) => {
    setSelectedCategory(category);
  };

  // Streak da categoria selecionada
  const selectedStreak = allStreaks?.find(
    (s) => s.category === selectedCategory
  );

  // Contar check-ins de hoje
  const todayCheckInCount = todayCheckIns?.length ?? 0;
  const totalCategories = Object.keys(allConfigs).length;

  return (
    <div className="min-h-screen">
      <Header
        title="Atividades"
        subtitle="Check-ins diarios"
        rightContent={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg border border-accent/30">
            <Zap size={16} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              {todayCheckInCount}/{totalCategories} hoje
            </span>
          </div>
        }
      />

      <div className="p-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Habit List - Left Side */}
          <div className="lg:col-span-1 min-h-0">
            <HabitCheckInList
              configs={allConfigs}
              todayCheckIns={todayCheckIns}
              streaks={allStreaks}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              onCheckIn={handleCheckIn}
              onUndoCheckIn={handleUndoCheckIn}
            />
          </div>

          {/* Calendar & Stats - Right Side */}
          <div className="lg:col-span-2 space-y-6 min-h-0">
            <HabitCalendar
              checkInDays={monthlyCheckIns}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDayToggle={handleDayToggle}
              isLoading={isLoading}
            />

            <HabitStats
              streak={selectedStreak}
              monthlyCheckIns={monthlyCheckIns?.length ?? 0}
              daysInMonth={daysInMonth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
