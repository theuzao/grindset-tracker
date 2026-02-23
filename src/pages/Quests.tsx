import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Swords,
  MoreVertical,
  Edit3,
  Trash2,
  AlertTriangle,
  List,
  Calendar,
  Clock,
  History,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useCustomCategories,
  useQuestsByMonth,
  useQuestsByDate,
  useUpcomingQuests,
  useOverdueQuests,
  useRecentCompletedQuests,
} from '@/database/hooks';
import { questRepository } from '@/database/repositories/questRepository';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { QuestModal } from '@/features/quests/QuestModal';
import { QuestCalendarView } from '@/features/quests/QuestCalendarView';
import {
  ACTIVITY_CONFIGS,
  INITIAL_ATTRIBUTES,
} from '@/features/gamification/constants';
import type { Quest, QuestCategory, ActivityCategory, ActivityConfig } from '@/types';

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  daily: 'Daily Quest',
  main: 'Main Quest',
  side: 'Side Quest',
};

function getAttributeFromCategory(
  category: ActivityCategory,
  allConfigs: Record<string, ActivityConfig>
): { label: string; color: string } | null {
  const config = allConfigs[category];
  if (!config) return null;

  const primaryAttr = config.attributeImpacts?.[0]?.attribute;

  if (primaryAttr) {
    const attrInfo =
      INITIAL_ATTRIBUTES[primaryAttr as keyof typeof INITIAL_ATTRIBUTES];
    if (attrInfo) {
      return { label: attrInfo.name.toUpperCase(), color: attrInfo.color };
    }
  }

  return null;
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

interface GroupedQuests {
  today: Quest[];
  tomorrow: Quest[];
  thisWeek: Quest[];
  next30Days: Quest[];
}

function groupQuestsByPeriod(quests: Quest[] | undefined): GroupedQuests {
  if (!quests) {
    return { today: [], tomorrow: [], thisWeek: [], next30Days: [] };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // End of current week (Sunday)
  const endOfWeek = new Date(today);
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endOfWeek.setDate(today.getDate() + daysUntilSunday);
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

  const grouped: GroupedQuests = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    next30Days: [],
  };

  quests.forEach((quest) => {
    const questDate = quest.scheduledDate;
    if (questDate === todayStr) {
      grouped.today.push(quest);
    } else if (questDate === tomorrowStr) {
      grouped.tomorrow.push(quest);
    } else if (questDate <= endOfWeekStr) {
      grouped.thisWeek.push(quest);
    } else {
      grouped.next30Days.push(quest);
    }
  });

  // Sort each group: pending first, then by date
  const sortQuests = (a: Quest, b: Quest) => {
    // Pending first, completed last
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    // Then by date
    return a.scheduledDate.localeCompare(b.scheduledDate);
  };

  grouped.today.sort(sortQuests);
  grouped.tomorrow.sort(sortQuests);
  grouped.thisWeek.sort(sortQuests);
  grouped.next30Days.sort(sortQuests);

  return grouped;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${day} ${months[date.getMonth()]}`;
}

interface QuestSectionProps {
  title: string;
  subtitle?: string;
  quests: Quest[];
  allConfigs: Record<string, ActivityConfig>;
  isLoading: string | null;
  onToggleComplete: (quest: Quest) => void;
  onFailQuest: (quest: Quest) => void;
  onDropdownClick: (questId: string, rect: DOMRect) => void;
  onCreateQuest?: () => void;
  emptyMessage?: string;
  showCreateOnEmpty?: boolean;
  showDate?: boolean;
  isOverdue?: boolean;
}

function QuestSection({
  title,
  subtitle,
  quests,
  allConfigs,
  isLoading,
  onToggleComplete,
  onFailQuest,
  onDropdownClick,
  onCreateQuest,
  emptyMessage,
  showCreateOnEmpty,
  showDate,
  isOverdue,
}: QuestSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {isOverdue ? (
            <AlertCircle size={20} className="text-red-400" />
          ) : (
            <Swords size={20} className="text-accent" />
          )}
          <CardTitle className={isOverdue ? 'text-red-400' : undefined}>{title}</CardTitle>
        </div>
        {subtitle && <span className={`text-sm ${isOverdue ? 'text-red-400/70' : 'text-gray-400'}`}>{subtitle}</span>}
      </CardHeader>
      <CardContent className="max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
        {quests.length > 0 ? (
          <div className="space-y-2">
            {quests.map((quest) => {
              const activityBadge = quest.relatedActivity
                ? getAttributeFromCategory(quest.relatedActivity, allConfigs)
                : null;

              return (
                <div
                  key={quest.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all group ${
                    quest.status === 'completed'
                      ? 'bg-accent/5 border border-accent/20 opacity-70'
                      : quest.status === 'failed'
                      ? 'bg-red-500/5 border border-red-500/20 opacity-70'
                      : 'bg-bg-tertiary border border-border hover:border-accent/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onToggleComplete(quest)}
                      disabled={isLoading === quest.id || quest.status === 'failed'}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        quest.status === 'completed'
                          ? 'border-accent bg-accent hover:bg-accent/80'
                          : quest.status === 'failed'
                          ? 'border-gray-600 cursor-not-allowed'
                          : 'border-gray-500 hover:border-accent'
                      }`}
                    >
                      {isLoading === quest.id ? (
                        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      ) : quest.status === 'completed' ? (
                        <CheckCircle2 size={14} className="text-white" />
                      ) : null}
                    </button>
                    {quest.status === 'pending' && (
                      <button
                        onClick={() => onFailQuest(quest)}
                        disabled={isLoading === quest.id}
                        className="w-6 h-6 rounded-md border-2 border-red-500/40 flex items-center justify-center transition-colors hover:border-red-500 hover:bg-red-500/20"
                        title="Não realizada"
                      >
                        <XCircle size={14} className="text-red-400" />
                      </button>
                    )}
                    {quest.status === 'failed' && (
                      <div className="w-6 h-6 rounded-md border-2 border-red-500 bg-red-500 flex items-center justify-center">
                        <XCircle size={14} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium ${
                        quest.status === 'completed'
                          ? 'text-gray-400 line-through'
                          : quest.status === 'failed'
                          ? 'text-red-400/60 line-through'
                          : 'text-white'
                      }`}
                    >
                      {quest.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {showDate && (
                        <span className="text-xs text-accent font-medium">
                          {formatDateLabel(quest.scheduledDate)}
                        </span>
                      )}
                      {activityBadge && (
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                          style={{
                            backgroundColor: `${activityBadge.color}20`,
                            color: activityBadge.color,
                          }}
                        >
                          {activityBadge.label}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {CATEGORY_LABELS[quest.category]}
                      </span>
                      {quest.estimatedDuration && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {formatDuration(quest.estimatedDuration)}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-accent font-semibold text-sm whitespace-nowrap">
                    +{quest.xpReward} XP
                  </span>

                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onDropdownClick(quest.id, rect);
                    }}
                    className="p-2 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : showCreateOnEmpty ? (
          <div className="text-center py-12">
            <Swords size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 mb-4">{emptyMessage}</p>
            {onCreateQuest && (
              <Button onClick={onCreateQuest}>
                <Plus size={16} className="mr-2" />
                Criar Primeira Quest
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Quests() {
  const upcomingQuests = useUpcomingQuests(30);
  const overdueQuests = useOverdueQuests();
  const recentCompleted = useRecentCompletedQuests(20);
  const groupedQuests = groupQuestsByPeriod(upcomingQuests);
  const customCategories = useCustomCategories(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [deletingQuest, setDeletingQuest] = useState<Quest | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [allConfigs, setAllConfigs] =
    useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);

  // Calendar view state
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);

  // Hooks for calendar view
  const monthQuests = useQuestsByMonth(currentMonth.year, currentMonth.month);
  const selectedDateQuests = useQuestsByDate(selectedDate);

  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  const handleToggleComplete = async (quest: Quest) => {
    setIsLoading(quest.id);
    try {
      if (quest.status === 'completed') {
        await questRepository.uncomplete(quest.id);
      } else if (quest.status === 'failed') {
        await questRepository.unfail(quest.id);
      } else {
        await questRepository.complete(quest.id);
      }
    } catch (error) {
      console.error('Failed to toggle quest:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleEdit = (quest: Quest) => {
    setEditingQuest(quest);
    setShowCreateModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async () => {
    if (deletingQuest) {
      try {
        await questRepository.delete(deletingQuest.id);
        setDeletingQuest(null);
      } catch (error) {
        console.error('Failed to delete quest:', error);
      }
    }
  };

  const handleFailQuest = async (quest: Quest) => {
    if (isLoading) return;
    setIsLoading(quest.id);
    try {
      await questRepository.fail(quest.id);
    } catch (error) {
      console.error('Failed to mark quest as failed:', error);
    } finally {
      setIsLoading(null);
    }
    setActiveDropdown(null);
    setDropdownPosition(null);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingQuest(null);
    setScheduledDate(null);
  };

  const handleCreateQuest = (date?: string) => {
    setScheduledDate(date || null);
    setEditingQuest(null);
    setShowCreateModal(true);
  };

  const todayCompletedCount =
    groupedQuests.today.filter((q) => q.status === 'completed').length;
  const todayTotalCount = groupedQuests.today.length;

  return (
    <div className="min-h-screen">
      <Header title="Quests" subtitle="Suas missoes diarias" />

      <div className="p-6 pb-10 space-y-6">
        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List size={16} className="mr-2" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={16} className="mr-2" />
              Calendario
            </Button>
          </div>

          {viewMode === 'list' && (
            <Button size="sm" onClick={() => handleCreateQuest()}>
              <Plus size={16} className="mr-1" />
              Nova Quest
            </Button>
          )}
        </div>

        {viewMode === 'list' ? (
          // List View - Grouped by period
          <div className="space-y-6">
            {/* Hoje */}
            <QuestSection
              title="Hoje"
              subtitle={`${todayCompletedCount} de ${todayTotalCount} completas`}
              quests={groupedQuests.today}
              allConfigs={allConfigs}
              isLoading={isLoading}
              onToggleComplete={handleToggleComplete}
              onFailQuest={handleFailQuest}
              onDropdownClick={(questId, rect) => {
                setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                setActiveDropdown(activeDropdown === questId ? null : questId);
              }}
              onCreateQuest={handleCreateQuest}
              emptyMessage="Nenhuma quest para hoje"
              showCreateOnEmpty
            />

            {/* Pendentes / Atrasadas */}
            {overdueQuests && overdueQuests.length > 0 && (
              <QuestSection
                title="Pendentes"
                subtitle={`${overdueQuests.length} atrasada${overdueQuests.length > 1 ? 's' : ''}`}
                quests={overdueQuests}
                allConfigs={allConfigs}
                isLoading={isLoading}
                onToggleComplete={handleToggleComplete}
                onFailQuest={handleFailQuest}
                onDropdownClick={(questId, rect) => {
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                  setActiveDropdown(activeDropdown === questId ? null : questId);
                }}
                showDate
                isOverdue
              />
            )}

            {/* Amanhã */}
            {groupedQuests.tomorrow.length > 0 && (
              <QuestSection
                title="Amanha"
                quests={groupedQuests.tomorrow}
                allConfigs={allConfigs}
                isLoading={isLoading}
                onToggleComplete={handleToggleComplete}
              onFailQuest={handleFailQuest}
                onDropdownClick={(questId, rect) => {
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                  setActiveDropdown(activeDropdown === questId ? null : questId);
                }}
              />
            )}

            {/* Esta Semana */}
            {groupedQuests.thisWeek.length > 0 && (
              <QuestSection
                title="Esta Semana"
                quests={groupedQuests.thisWeek}
                allConfigs={allConfigs}
                isLoading={isLoading}
                onToggleComplete={handleToggleComplete}
              onFailQuest={handleFailQuest}
                onDropdownClick={(questId, rect) => {
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                  setActiveDropdown(activeDropdown === questId ? null : questId);
                }}
                showDate
              />
            )}

            {/* Próximos 30 dias */}
            {groupedQuests.next30Days.length > 0 && (
              <QuestSection
                title="Proximos 30 Dias"
                quests={groupedQuests.next30Days}
                allConfigs={allConfigs}
                isLoading={isLoading}
                onToggleComplete={handleToggleComplete}
              onFailQuest={handleFailQuest}
                onDropdownClick={(questId, rect) => {
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                  setActiveDropdown(activeDropdown === questId ? null : questId);
                }}
                showDate
              />
            )}

            {/* Histórico */}
            {recentCompleted && recentCompleted.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History size={20} className="text-gray-400" />
                    <CardTitle>Historico</CardTitle>
                  </div>
                  <span className="text-sm text-gray-500">{recentCompleted.length} recentes</span>
                </CardHeader>
                <CardContent className="max-h-[50vh] overflow-y-auto scrollbar-thin pr-2">
                  <div className="space-y-2">
                    {recentCompleted.map((quest) => (
                      <div
                        key={quest.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border opacity-70 group ${
                          quest.status === 'failed'
                            ? 'bg-red-500/5 border-red-500/20'
                            : 'bg-bg-tertiary/50 border-border'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                          quest.status === 'failed' ? 'bg-red-500/20' : 'bg-accent/20'
                        }`}>
                          {quest.status === 'failed' ? (
                            <XCircle size={14} className="text-red-400" />
                          ) : (
                            <CheckCircle2 size={14} className="text-accent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium line-through ${
                            quest.status === 'failed' ? 'text-red-400/60' : 'text-gray-400'
                          }`}>
                            {quest.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">
                              {CATEGORY_LABELS[quest.category]}
                            </span>
                            {(quest.completedAt || quest.status === 'failed') && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={10} />
                                {quest.completedAt
                                  ? formatFullDate(quest.completedAt)
                                  : new Date(quest.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`font-semibold text-sm whitespace-nowrap ${
                          quest.status === 'failed' ? 'text-red-400/60' : 'text-accent/60'
                        }`}>
                          {quest.status === 'failed' ? '-' : '+'}{quest.xpReward} XP
                        </span>
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                            setActiveDropdown(activeDropdown === quest.id ? null : quest.id);
                          }}
                          className="p-2 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Calendar View
          <QuestCalendarView
            monthQuests={monthQuests}
            selectedDate={selectedDate}
            selectedDateQuests={selectedDateQuests}
            currentMonth={currentMonth}
            onDateSelect={setSelectedDate}
            onMonthChange={setCurrentMonth}
            onCreateQuest={handleCreateQuest}
            onCompleteQuest={(questId) => {
              const quest = selectedDateQuests?.find((q) => q.id === questId);
              if (quest) handleToggleComplete(quest);
            }}
            onEditQuest={handleEdit}
          />
        )}
      </div>

      <QuestModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        editingQuest={editingQuest}
        allConfigs={allConfigs}
        initialScheduledDate={scheduledDate}
      />

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
                onClick={handleDelete}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dropdown Menu - Rendered as fixed overlay */}
      {activeDropdown && dropdownPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setActiveDropdown(null);
              setDropdownPosition(null);
            }}
          />
          {(() => {
            const allQuests = [
              ...groupedQuests.today,
              ...groupedQuests.tomorrow,
              ...groupedQuests.thisWeek,
              ...groupedQuests.next30Days,
              ...(overdueQuests || []),
              ...(recentCompleted || []),
            ];
            const quest = allQuests.find((q) => q.id === activeDropdown) ||
                          selectedDateQuests?.find((q) => q.id === activeDropdown);
            if (!quest) return null;

            return (
              <div
                className="fixed z-50 w-36 bg-bg-tertiary border border-border rounded-lg shadow-xl overflow-hidden"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                }}
              >
                {(quest.status === 'completed' || quest.status === 'failed') && (
                  <button
                    onClick={() => {
                      handleToggleComplete(quest);
                      setActiveDropdown(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                  >
                    <XCircle size={14} />
                    Desmarcar
                  </button>
                )}
                <button
                  onClick={() => handleEdit(quest)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-bg-hover hover:text-white transition-colors"
                >
                  <Edit3 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => {
                    setDeletingQuest(quest);
                    setActiveDropdown(null);
                    setDropdownPosition(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
