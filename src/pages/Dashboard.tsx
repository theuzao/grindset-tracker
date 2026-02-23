import { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import {
  Plus,
  Clock,
  TrendingUp,
  Flame,
  Target,
  Zap,
  Flag,
  Calendar,
  Lightbulb,
  Pin,
  Check,
  MoreVertical,
  Edit3,
  Trash2,
  AlertTriangle,
  User,
  XCircle,
  GripVertical,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import {
  useCharacter,
  useTodayQuests,
  useQuestsByDate,
  useTodayCheckIns,
  useAllCheckInStreaks,
  useCustomCategories,
  useActiveObjectives,
  usePinnedReflections,
} from '@/database/hooks';
import { ACTIVITY_CONFIGS, getXPProgressInLevel } from '@/features/gamification/constants';
import { OnboardingModal } from '@/features/character/OnboardingModal';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { questRepository } from '@/database/repositories/questRepository';
import { checkInRepository } from '@/database/repositories/checkInRepository';
import { QuestModal } from '@/features/quests/QuestModal';
import { getLocalDateString } from '@/database/db';
import { AnkiDashboardWidget } from '@/features/anki/AnkiDashboardWidget';
import type { ActivityCategory, ActivityConfig, Quest } from '@/types';

// Get tomorrow's date string
const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
};

export function Dashboard() {
  const character = useCharacter();
  const todayQuests = useTodayQuests();
  const tomorrowQuests = useQuestsByDate(getTomorrowDate());
  const todayCheckIns = useTodayCheckIns();
  const allStreaks = useAllCheckInStreaks();
  const customCategories = useCustomCategories(true);
  const activeObjectives = useActiveObjectives();
  const pinnedReflections = usePinnedReflections();

  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);

  // Quest Modal state
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [deletingQuest, setDeletingQuest] = useState<Quest | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [isProcessingQuest, setIsProcessingQuest] = useState<string | null>(null);

  // Quest drag order
  const [questOrder, setQuestOrder] = useState<Quest[]>([]);

  useEffect(() => {
    if (!todayQuests) return;
    const today = getLocalDateString();
    let storedIds: string[] = [];
    try {
      const stored = localStorage.getItem(`quest-order-${today}`);
      storedIds = stored ? JSON.parse(stored) : [];
    } catch {}
    const questMap = new Map(todayQuests.map(q => [q.id, q]));
    const ordered: Quest[] = [];
    for (const id of storedIds) {
      if (questMap.has(id)) {
        ordered.push(questMap.get(id)!);
        questMap.delete(id);
      }
    }
    for (const q of questMap.values()) {
      ordered.push(q);
    }
    setQuestOrder(ordered);
  }, [todayQuests]);

  const handleReorder = (newOrder: Quest[]) => {
    const today = getLocalDateString();
    localStorage.setItem(`quest-order-${today}`, JSON.stringify(newOrder.map(q => q.id)));
    setQuestOrder(newOrder);
  };

  // Carregar todas as configs (padrao + customizadas)
  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  // Mostrar onboarding se nao tiver personagem
  if (character === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!character) {
    return <OnboardingModal isOpen={true} onComplete={() => window.location.reload()} />;
  }

  const completedQuests = todayQuests?.filter((q) => q.status === 'completed').length ?? 0;
  const totalQuests = todayQuests?.length ?? 0;
  const todayCheckInCount = todayCheckIns?.length ?? 0;
  const totalCategories = Object.keys(allConfigs).length;

  // Get check-in for a category
  const getCheckIn = (category: string) =>
    todayCheckIns?.find((c) => c.category === category);

  // Get streak for a category
  const getStreak = (category: string) =>
    allStreaks?.find((s) => s.category === category)?.currentStreak ?? 0;

  // Handle check-in toggle
  const handleCheckInToggle = async (category: ActivityCategory) => {
    if (isCheckingIn) return;

    const checkIn = getCheckIn(category);
    setIsCheckingIn(category);
    try {
      if (checkIn) {
        await checkInRepository.undoCheckIn(checkIn.id);
      } else {
        await checkInRepository.checkIn(category);
      }
    } catch (error) {
      console.error('Failed to toggle check-in:', error);
    } finally {
      setIsCheckingIn(null);
    }
  };

  // Handle quest toggle
  const handleQuestToggle = async (quest: Quest) => {
    if (isProcessingQuest) return;
    setIsProcessingQuest(quest.id);
    try {
      if (quest.status === 'completed') {
        await questRepository.uncomplete(quest.id);
      } else {
        await questRepository.complete(quest.id);
      }
    } catch (error) {
      console.error('Failed to toggle quest:', error);
    } finally {
      setIsProcessingQuest(null);
    }
  };

  // Handle quest edit
  const handleEditQuest = (quest: Quest) => {
    setEditingQuest(quest);
    setShowQuestModal(true);
    setActiveDropdown(null);
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

  // Handle quest fail (não realizada)
  const handleFailQuest = async (quest: Quest) => {
    if (isProcessingQuest) return;
    setIsProcessingQuest(quest.id);
    try {
      await questRepository.fail(quest.id);
    } catch (error) {
      console.error('Failed to mark quest as failed:', error);
    } finally {
      setIsProcessingQuest(null);
    }
    setActiveDropdown(null);
    setDropdownPosition(null);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowQuestModal(false);
    setEditingQuest(null);
  };

  // Get streak for a category
  const getTotalDays = (category: string) =>
    allStreaks?.find((s) => s.category === category)?.totalCheckIns ?? 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title="Dashboard"
        subtitle={`Ola, ${character.name}!`}
      />

      <div className="p-6 lg:p-8 pb-10 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-bg-secondary border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black text-primary">
                  {todayCheckInCount}/{totalCategories}
                </p>
                <p className="text-xs text-gray-500">Check-ins Hoje</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-bg-secondary border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{character.streak.current}</p>
                <p className="text-xs text-gray-500">Dias Streak</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-bg-secondary border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {completedQuests}/{totalQuests}
                </p>
                <p className="text-xs text-gray-500">Quests Hoje</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-bg-secondary border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {character.totalXP.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">XP Total</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Check-ins & Quests */}
          <div className="xl:col-span-2 space-y-6 min-h-0">
            {/* Check-ins Section - Lista */}
            <Card className="bg-bg-secondary border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-accent" />
                  <CardTitle>Habitos Diarios</CardTitle>
                </div>
                <Badge variant="accent">
                  {todayCheckInCount}/{totalCategories}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(allConfigs).map(([key, config]) => {
                  const checkIn = getCheckIn(key);
                  const checked = !!checkIn;
                  const streak = getStreak(key);
                  const totalDays = getTotalDays(key);
                  const isLoading = isCheckingIn === key;

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        checked
                          ? 'bg-accent/10 border border-accent/30'
                          : 'bg-bg-tertiary border border-border hover:border-accent/20'
                      }`}
                    >
                      {/* Check-in button */}
                      <button
                        onClick={() => handleCheckInToggle(key as ActivityCategory)}
                        disabled={isLoading}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          checked
                            ? 'border-accent bg-accent hover:bg-accent/80'
                            : 'border-gray-500 hover:border-accent'
                        }`}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : checked ? (
                          <Check size={16} className="text-white" />
                        ) : null}
                      </button>

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-bg-tertiary">
                        <span style={{ color: config.color }}>
                          <ActivityIcon icon={config.icon} size={20} />
                        </span>
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
                          <span className="flex items-center gap-1 text-gray-400">
                            <Zap size={12} className="text-accent" />
                            {totalDays} Dias
                          </span>
                          {streak > 0 && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <Flame size={12} className="text-orange-400" />
                              {streak} Dia{streak > 1 ? 's' : ''}
                            </span>
                          )}
                          {streak === 0 && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Flame size={12} />
                              0 Dia
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Character, Quests & Objectives */}
          <div className="space-y-6 min-h-0">
            {/* Mini Character Card */}
            <Card className="bg-bg-secondary border-border overflow-hidden">
              <div
                className="relative h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent"
                style={character.banner ? (
                  character.banner.startsWith('linear-gradient') || (character.banner.startsWith('#') && character.banner.length <= 9)
                    ? { background: character.banner }
                    : {
                        backgroundImage: `url(${character.banner})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                ) : undefined}
              >
                {character.banner && !character.banner.startsWith('linear-gradient') && !character.banner.startsWith('#') && (
                  <div className="absolute inset-0 bg-black/40" />
                )}
              </div>
              <CardContent className="-mt-8 relative z-10">
                {(() => {
                  const xpProgress = getXPProgressInLevel(character.totalXP);
                  return (
                    <>
                      <div className="flex items-end gap-4">
                        <div className="relative w-16 h-16 rounded-xl bg-bg-tertiary border-2 border-primary/30 overflow-hidden shadow-lg">
                          {character.avatar ? (
                            <img
                              src={character.avatar}
                              alt={character.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User size={32} className="text-primary" />
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                            {character.level}
                          </div>
                        </div>
                        <div className="flex-1 pb-1">
                          <h3 className="font-bold text-white">{character.name}</h3>
                          <p className="text-xs text-primary">{character.title}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">
                            Nivel {character.level} → {character.level + 1}
                          </span>
                          <span className="text-primary font-medium">
                            {xpProgress.currentLevelXP.toLocaleString()} /{' '}
                            {xpProgress.requiredXP.toLocaleString()} XP
                          </span>
                        </div>
                        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${xpProgress.percentage}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">
                          Total: {character.totalXP.toLocaleString()} XP
                        </p>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Anki Widget */}
            <AnkiDashboardWidget />

            {/* Today's Quests List */}
            <Card className="bg-bg-secondary border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target size={20} className="text-primary" />
                  <CardTitle>Quests de Hoje</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="accent">
                    {completedQuests}/{totalQuests}
                  </Badge>
                  <button
                    onClick={() => setShowQuestModal(true)}
                    className="p-1 rounded hover:bg-bg-tertiary text-gray-400 hover:text-primary transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {todayQuests && todayQuests.length > 0 ? (
                  <Reorder.Group
                    axis="y"
                    values={questOrder}
                    onReorder={handleReorder}
                    as="div"
                    className="space-y-2"
                  >
                    {questOrder.map((quest) => (
                      <Reorder.Item
                        key={quest.id}
                        value={quest}
                        as="div"
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all group cursor-default ${
                          quest.status === 'completed'
                            ? 'bg-primary/5 border border-primary/20'
                            : quest.status === 'failed'
                            ? 'bg-red-500/5 border border-red-500/20'
                            : 'bg-bg-tertiary border border-border hover:border-primary/30'
                        }`}
                      >
                        <div
                          className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 shrink-0"
                          title="Arrastar para reordenar"
                        >
                          <GripVertical size={14} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleQuestToggle(quest)}
                            disabled={quest.status === 'failed' || isProcessingQuest === quest.id}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              quest.status === 'completed'
                                ? 'border-primary bg-primary hover:bg-primary/80'
                                : quest.status === 'failed'
                                ? 'border-gray-600 cursor-not-allowed'
                                : 'border-gray-500 hover:border-primary'
                            }`}
                          >
                            {isProcessingQuest === quest.id ? (
                              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : quest.status === 'completed' ? (
                              <Check size={12} className="text-white" />
                            ) : null}
                          </button>
                          {quest.status === 'pending' && (
                            <button
                              onClick={() => handleFailQuest(quest)}
                              disabled={isProcessingQuest === quest.id}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="w-5 h-5 rounded-full border-2 border-red-500/40 flex items-center justify-center transition-colors hover:border-red-500 hover:bg-red-500/20"
                              title="Não realizada"
                            >
                              <XCircle size={12} className="text-red-400" />
                            </button>
                          )}
                          {quest.status === 'failed' && (
                            <div className="w-5 h-5 rounded-full border-2 border-red-500 bg-red-500 flex items-center justify-center">
                              <XCircle size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm block truncate ${
                              quest.status === 'completed'
                                ? 'text-gray-500 line-through'
                                : quest.status === 'failed'
                                ? 'text-red-400/60 line-through'
                                : 'text-white'
                            }`}
                          >
                            {quest.title}
                          </span>
                          <div className="flex items-center gap-3 mt-0.5">
                            {quest.estimatedDuration && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={10} />
                                {quest.estimatedDuration < 60
                                  ? `${quest.estimatedDuration}min`
                                  : `${Math.floor(quest.estimatedDuration / 60)}h${
                                      quest.estimatedDuration % 60 > 0
                                        ? quest.estimatedDuration % 60
                                        : ''
                                    }`}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-primary font-medium whitespace-nowrap">
                          +{quest.xpReward} XP
                        </span>

                        {/* Dropdown Menu */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 144 });
                            setActiveDropdown(activeDropdown === quest.id ? null : quest.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                ) : (
                  <div className="text-center py-6">
                    <Target size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm mb-2">Nenhuma quest para hoje</p>
                    <Button size="sm" variant="ghost" onClick={() => setShowQuestModal(true)}>
                      <Plus size={14} className="mr-1" />
                      Criar Quest
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tomorrow's Quests List */}
            {tomorrowQuests && tomorrowQuests.length > 0 && (
              <Card className="bg-bg-secondary border-border">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-blue-400" />
                    <CardTitle>Quests de Amanha</CardTitle>
                  </div>
                  <Badge variant="info">{tomorrowQuests.length}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tomorrowQuests.map((quest) => (
                      <div
                        key={quest.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border"
                      >
                        <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm block truncate text-white">
                            {quest.title}
                          </span>
                          {quest.estimatedDuration && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {quest.estimatedDuration < 60
                                ? `${quest.estimatedDuration}min`
                                : `${Math.floor(quest.estimatedDuration / 60)}h${
                                    quest.estimatedDuration % 60 > 0
                                      ? quest.estimatedDuration % 60
                                      : ''
                                  }`}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-blue-400 font-medium whitespace-nowrap">
                          +{quest.xpReward} XP
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Objectives */}
            <Card className="bg-bg-secondary border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Flag size={20} className="text-purple-400" />
                  <CardTitle>Objetivos Ativos</CardTitle>
                </div>
                <Badge variant="accent">{activeObjectives?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent>
                {activeObjectives && activeObjectives.length > 0 ? (
                  <div className="space-y-3">
                    {activeObjectives.slice(0, 4).map((objective) => {
                      const daysRemaining = Math.ceil(
                        (new Date(objective.targetDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      );
                      const isOverdue = daysRemaining < 0;
                      const isUrgent = daysRemaining >= 0 && daysRemaining <= 7;

                      return (
                        <div
                          key={objective.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isOverdue
                              ? 'bg-red-500/5 border-red-500/30'
                              : isUrgent
                              ? 'bg-orange-500/5 border-orange-500/30'
                              : 'bg-bg-tertiary border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium text-white line-clamp-1">
                              {objective.title}
                            </span>
                            <span className="text-xs text-primary font-medium ml-2 whitespace-nowrap">
                              +{objective.xpReward}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden mb-1.5">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all"
                              style={{ width: `${objective.progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                              {objective.progress}% •{' '}
                              {objective.milestones.filter((m) => m.isCompleted).length}/
                              {objective.milestones.length} milestones
                            </span>
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue
                                  ? 'text-red-400'
                                  : isUrgent
                                  ? 'text-orange-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              <Calendar size={10} />
                              {isOverdue
                                ? `${Math.abs(daysRemaining)}d atrasado`
                                : `${daysRemaining}d`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {activeObjectives.length > 4 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{activeObjectives.length - 4} objetivos
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Flag size={24} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">Nenhum objetivo ativo</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pinned Reflections */}
            {pinnedReflections && pinnedReflections.length > 0 && (
              <Card className="bg-bg-secondary border-border">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Pin size={20} className="text-amber-400" />
                    <CardTitle>Notas Fixadas</CardTitle>
                  </div>
                  <Badge variant="accent">{pinnedReflections.length}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pinnedReflections.slice(0, 3).map((reflection) => (
                      <div
                        key={reflection.id}
                        className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <Lightbulb
                            size={14}
                            className="text-amber-400 mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            {reflection.title && (
                              <p className="text-sm font-medium text-white truncate">
                                {reflection.title}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 line-clamp-2">
                              {reflection.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Quest Modal */}
      <QuestModal
        isOpen={showQuestModal}
        onClose={handleCloseModal}
        editingQuest={editingQuest}
        allConfigs={allConfigs}
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
            const quest = todayQuests?.find((q) => q.id === activeDropdown);
            if (!quest) return null;

            return (
              <div
                className="fixed z-50 w-36 bg-bg-tertiary border border-border rounded-lg shadow-xl overflow-hidden"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                }}
              >
                {quest.status === 'completed' && (
                  <button
                    onClick={() => {
                      handleQuestToggle(quest);
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
                  onClick={() => handleEditQuest(quest)}
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
