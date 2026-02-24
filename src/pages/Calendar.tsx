import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Zap,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import {
  useQuestsByMonth,
  useQuestsByDate,
  useAllCheckInsByMonth,
  useCheckInsByDate,
  useCustomCategories,
  useSubjectExams,
  useSubjects,
} from '@/database/hooks';
import { questRepository } from '@/database/repositories/questRepository';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { getLocalDateString } from '@/database/db';
import { QuestModal } from '@/features/quests/QuestModal';
import { ACTIVITY_CONFIGS } from '@/features/gamification/constants';
import { getStoredQuestColors, type QuestCategoryColors } from '@/utils/theme';
import type { Quest, CheckIn, ActivityConfig, SubjectExam, Subject } from '@/types';

const EXAM_TYPE_SHORT: Record<string, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  lista: 'Lista',
  seminario: 'Seminário',
  outro: 'Tarefa',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
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

export function Calendar() {
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showDayModal, setShowDayModal] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [deletingQuest, setDeletingQuest] = useState<Quest | null>(null);
  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);
  const [questColors, setQuestColors] = useState<QuestCategoryColors>(getStoredQuestColors);
  const customCategories = useCustomCategories(true);

  // Listen for quest colors changes
  useEffect(() => {
    const handleStorageChange = () => {
      setQuestColors(getStoredQuestColors());
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check on focus (for changes made in same tab)
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  // Fetch data
  const monthQuests = useQuestsByMonth(currentMonth.year, currentMonth.month);
  const monthCheckIns = useAllCheckInsByMonth(currentMonth.year, currentMonth.month);
  const selectedDateQuests = useQuestsByDate(selectedDate);
  const selectedDateCheckIns = useCheckInsByDate(selectedDate);
  const allExams = useSubjectExams();
  const allSubjects = useSubjects();

  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  // Group data by date
  const dataByDate = useMemo(() => {
    const map = new Map<string, { quests: Quest[]; checkIns: CheckIn[] }>();

    monthQuests?.forEach((quest) => {
      const date = quest.scheduledDate;
      if (!map.has(date)) map.set(date, { quests: [], checkIns: [] });
      map.get(date)!.quests.push(quest);
    });

    monthCheckIns?.forEach((checkIn) => {
      const date = checkIn.date;
      if (!map.has(date)) map.set(date, { quests: [], checkIns: [] });
      map.get(date)!.checkIns.push(checkIn);
    });

    return map;
  }, [monthQuests, monthCheckIns]);

  const subjectMap = useMemo(() => {
    return Object.fromEntries((allSubjects ?? []).map((s: Subject) => [s.id, s]));
  }, [allSubjects]);

  const examsByDate = useMemo(() => {
    const map = new Map<string, SubjectExam[]>();
    for (const exam of allExams ?? []) {
      if (!map.has(exam.scheduledDate)) map.set(exam.scheduledDate, []);
      map.get(exam.scheduledDate)!.push(exam);
    }
    return map;
  }, [allExams]);

  const selectedDateExams = examsByDate.get(selectedDate) ?? [];

  // Calendar calculations
  const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.year, currentMonth.month - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth.month === today.getMonth() + 1 &&
    currentMonth.year === today.getFullYear();

  const isSelected = (day: number) => {
    const dateStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  const getDateString = (day: number) =>
    `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const goToPrevMonth = () => {
    if (currentMonth.month === 1) {
      setCurrentMonth({ year: currentMonth.year - 1, month: 12 });
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month - 1 });
    }
  };

  const goToNextMonth = () => {
    if (currentMonth.month === 12) {
      setCurrentMonth({ year: currentMonth.year + 1, month: 1 });
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month + 1 });
    }
  };

  // Calculate weeks
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

  // Handle day click - open modal
  const handleDayClick = (day: number) => {
    const dateStr = getDateString(day);
    setSelectedDate(dateStr);
    setShowDayModal(true);
  };

  // Handle quest toggle
  const handleQuestToggle = async (quest: Quest) => {
    try {
      if (quest.status === 'completed') {
        await questRepository.uncomplete(quest.id);
      } else {
        await questRepository.complete(quest.id);
      }
    } catch (error) {
      console.error('Failed to toggle quest:', error);
    }
  };

  // Handle quest edit
  const handleEditQuest = (quest: Quest) => {
    setEditingQuest(quest);
    setShowQuestModal(true);
  };

  // Handle quest delete
  const handleDeleteQuest = async () => {
    if (deletingQuest) {
      try {
        await questRepository.delete(deletingQuest.id);
        setDeletingQuest(null);
      } catch (error) {
        console.error('Failed to delete quest:', error);
      }
    }
  };

  // Handle modal close
  const handleCloseQuestModal = () => {
    setShowQuestModal(false);
    setEditingQuest(null);
  };

  // Format selected date
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const selectedDateDisplay = selectedDateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen">
      <Header title="Calendário" subtitle="Visão geral do mês" />

      <div className="p-6 pb-10">
        {/* Full-width Calendar */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader className="py-5">
            <div className="flex items-center justify-between w-full">
              <button
                onClick={goToPrevMonth}
                className="p-2.5 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <ChevronLeft size={24} className="text-gray-400" />
              </button>
              <CardTitle className="text-center text-xl capitalize">
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
          <CardContent className="px-4 pb-6">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-3 mb-4">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={i}
                  className="text-center text-base text-gray-400 py-2 font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-2">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-2">
                  {week.map((day, dayIndex) => {
                    if (day === null) {
                      return (
                        <div
                          key={dayIndex}
                          className="h-[170px] bg-bg-tertiary/20 rounded-lg"
                        />
                      );
                    }

                    const dateStr = getDateString(day);
                    const dayData = dataByDate.get(dateStr);
                    const dayQuests = dayData?.quests || [];
                    const dayCheckIns = dayData?.checkIns || [];
                    const todayClass = isToday(day);
                    const selectedClass = isSelected(day);

                    const dayExams = examsByDate.get(dateStr) ?? [];
                    // Calcular quantas quests mostrar baseado no espaço
                    const maxQuests = Math.max(0, (dayCheckIns.length > 0 ? 4 : 5) - dayExams.length);
                    const visibleQuests = dayQuests.slice(0, maxQuests);
                    const remainingQuests = dayQuests.length - maxQuests;

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => handleDayClick(day)}
                        className={`h-[170px] rounded-lg cursor-pointer transition-all hover:brightness-110 flex flex-col ${
                          selectedClass
                            ? 'bg-accent/15 ring-2 ring-accent'
                            : todayClass
                            ? 'bg-bg-tertiary ring-2 ring-accent/50'
                            : 'bg-bg-tertiary/80 hover:bg-bg-tertiary'
                        }`}
                      >
                        {/* Day header */}
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
                          <span
                            className={`text-sm font-bold ${
                              selectedClass
                                ? 'text-white'
                                : 'text-accent'
                            }`}
                          >
                            {day}
                          </span>
                          {/* Check-in dots inline */}
                          {dayCheckIns.length > 0 && (
                            <div className="flex gap-1">
                              {dayCheckIns.slice(0, 4).map((checkIn, i) => {
                                const config = allConfigs[checkIn.category];
                                return (
                                  <div
                                    key={i}
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: config?.color || '#888' }}
                                    title={config?.name || checkIn.category}
                                  />
                                );
                              })}
                              {dayCheckIns.length > 4 && (
                                <span className="text-[9px] text-gray-500">+{dayCheckIns.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quest blocks - TickTick style */}
                        <div className="flex-1 overflow-hidden p-1 space-y-0.5">
                          {dayExams.map((exam) => {
                            const subj = subjectMap[exam.subjectId];
                            const color = subj?.color ?? '#ef4444';
                            return (
                              <div
                                key={exam.id}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-sm leading-tight border"
                                style={{ borderColor: color, backgroundColor: `${color}18` }}
                                title={`${EXAM_TYPE_SHORT[exam.type] ?? 'Tarefa'}: ${exam.title}${subj ? ` — ${subj.name}` : ''}`}
                              >
                                <span className="flex-1 truncate font-medium text-xs" style={{ color }}>
                                  {subj ? `${subj.name}: ` : ''}{exam.title}
                                </span>
                              </div>
                            );
                          })}
                          {visibleQuests.map((quest) => (
                            <div
                              key={quest.id}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-sm leading-tight ${
                                quest.status === 'completed'
                                  ? 'opacity-40'
                                  : quest.status === 'failed'
                                  ? 'opacity-50'
                                  : ''
                              }`}
                              style={{
                                backgroundColor:
                                  quest.status === 'failed'
                                    ? '#ef4444'
                                    : questColors[quest.category],
                              }}
                              title={quest.title}
                            >
                              <span
                                className={`flex-1 truncate font-medium text-white ${
                                  quest.status === 'completed' || quest.status === 'failed'
                                    ? 'line-through'
                                    : ''
                                }`}
                              >
                                {quest.title}
                              </span>
                              {quest.status === 'failed' ? (
                                <X size={10} className="text-white/70 flex-shrink-0" />
                              ) : quest.estimatedDuration ? (
                                <span className="text-[10px] text-white/70 flex-shrink-0">
                                  {formatDuration(quest.estimatedDuration)}
                                </span>
                              ) : null}
                            </div>
                          ))}
                          {remainingQuests > 0 && (
                            <div className="text-xs text-gray-500 px-1.5 py-0.5">
                              +{remainingQuests} mais
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
            <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-border">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Legenda:</span>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                Check-ins
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-10 h-4 rounded"
                  style={{ backgroundColor: questColors.daily }}
                />
                Daily
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-10 h-4 rounded"
                  style={{ backgroundColor: questColors.main }}
                />
                Main
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-10 h-4 rounded"
                  style={{ backgroundColor: questColors.side }}
                />
                Side
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div
                  className="w-10 h-4 rounded opacity-50"
                  style={{ backgroundColor: '#ef4444' }}
                />
                Não realizada
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day Modal - Shows quests and check-ins for selected day */}
      <Modal
        isOpen={showDayModal}
        onClose={() => setShowDayModal(false)}
        title=""
        size="md"
      >
        <div className="space-y-6">
          {/* Day header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-white capitalize">
                {selectedDateDisplay}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedDateQuests?.length ?? 0} quests •{' '}
                {selectedDateCheckIns?.length ?? 0} check-ins
              </p>
            </div>
            {selectedDate >= getLocalDateString() && (
              <Button
                size="sm"
                onClick={() => {
                  setShowQuestModal(true);
                }}
              >
                <Plus size={14} className="mr-1" />
                Nova Quest
              </Button>
            )}
          </div>

          {/* Check-ins section */}
          {selectedDateCheckIns && selectedDateCheckIns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-3">
                <Zap size={14} className="text-accent" />
                Check-ins do Dia
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedDateCheckIns.map((checkIn) => {
                  const config = allConfigs[checkIn.category];
                  return (
                    <div
                      key={checkIn.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: `${config?.color || '#888'}20`,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center"
                        style={{
                          backgroundColor: `${config?.color || '#888'}30`,
                          color: config?.color || '#888',
                        }}
                      >
                        <ActivityIcon icon={config?.icon || 'Zap'} size={16} />
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: config?.color || '#888' }}
                      >
                        {config?.name || checkIn.category}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Faculdade exams section */}
          {selectedDateExams.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-red-400" />
                Faculdade
              </h3>
              <div className="space-y-2">
                {selectedDateExams.map((exam) => {
                  const subj = subjectMap[exam.subjectId];
                  const color = subj?.color ?? '#ef4444';
                  return (
                    <div
                      key={exam.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                      style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {subj ? `${subj.name}: ` : ''}{exam.title}
                        </p>
                      </div>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {EXAM_TYPE_SHORT[exam.type] ?? 'Tarefa'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quests section */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-3">
              <CalendarIcon size={14} className="text-primary" />
              Quests do Dia
            </h3>
            {selectedDateQuests && selectedDateQuests.length > 0 ? (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
                {[...selectedDateQuests]
                  .sort((a, b) => {
                    const order = { pending: 0, failed: 1, completed: 2 };
                    return (order[a.status] ?? 0) - (order[b.status] ?? 0);
                  })
                  .map((quest) => (
                  <div
                    key={quest.id}
                    className={`p-3 rounded-lg border transition-all group ${
                      quest.status === 'completed'
                        ? 'bg-bg-tertiary/50 border-border opacity-60'
                        : quest.status === 'failed'
                        ? 'bg-red-500/5 border-red-500/20 opacity-60'
                        : 'bg-bg-tertiary border-border hover:border-accent/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {quest.status === 'failed' ? (
                        <div className="w-6 h-6 rounded-full border-2 border-red-500 bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X size={14} className="text-white" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleQuestToggle(quest)}
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
                      )}

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium ${
                            quest.status === 'completed'
                              ? 'text-gray-500 line-through'
                              : quest.status === 'failed'
                              ? 'text-red-400/70 line-through'
                              : 'text-white'
                          }`}
                        >
                          {quest.title}
                        </p>
                        {quest.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {quest.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{
                              backgroundColor: questColors[quest.category] + '20',
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
                          <span className="text-xs text-accent font-medium">
                            +{quest.xpReward} XP
                          </span>
                          <span className="text-xs text-yellow-500 font-medium">
                            +{quest.goldReward} Gold
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                        <button
                          onClick={() => handleEditQuest(quest)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingQuest(quest)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-bg-tertiary rounded-xl">
                <CalendarIcon size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500">Nenhuma quest para este dia</p>
                {selectedDate >= getLocalDateString() && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setShowQuestModal(true)}
                  >
                    <Plus size={14} className="mr-1" />
                  Adicionar Quest
                </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <QuestModal
        isOpen={showQuestModal}
        onClose={handleCloseQuestModal}
        editingQuest={editingQuest}
        allConfigs={allConfigs}
        initialScheduledDate={selectedDate}
      />

      {/* Delete Confirmation Modal */}
      {deletingQuest && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingQuest(null)}
          title="Excluir Quest"
          size="sm"
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 size={32} className="text-red-400" />
            </div>
            <p className="text-gray-300 mb-4">
              Tem certeza que deseja excluir a quest{' '}
              <span className="text-white font-medium">
                "{deletingQuest.title}"
              </span>
              ?
            </p>

            {deletingQuest.status === 'completed' && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
                  <AlertTriangle size={16} />
                  <span className="font-medium">Aviso</span>
                </div>
                <p className="text-sm text-amber-400/80">
                  Voce perdera{' '}
                  <span className="font-bold">-{deletingQuest.xpReward} XP</span>{' '}
                  e{' '}
                  <span className="font-bold">
                    -{deletingQuest.goldReward} Gold
                  </span>{' '}
                  ao excluir esta quest completa.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDeletingQuest(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDeleteQuest}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
