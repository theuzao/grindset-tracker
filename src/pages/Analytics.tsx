import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Target, AlertTriangle, Zap, Award, ChevronDown, ChevronUp, Dumbbell, Info, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCharacter, useActivities, useActiveDebuffs, useActivityGoals, useQuests, useCustomCategories, useXPEvents } from '@/database/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database/db';
import { AttributeRadar } from '@/components/charts/AttributeRadar';
import { INITIAL_ATTRIBUTES, ACTIVITY_CONFIGS } from '@/features/gamification/constants';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { goalRepository } from '@/database/repositories/goalRepository';
import type { ActivityConfig, ActivityGoal, GoalProgress, AttributeType } from '@/types';

export function Analytics() {
  const character = useCharacter();
  const activities = useActivities(undefined, 100);
  const activeDebuffs = useActiveDebuffs();
  const activityGoals = useActivityGoals(true);
  const quests = useQuests();
  const customCategories = useCustomCategories(true);
  const xpEvents = useXPEvents(30);
  const allCheckIns = useLiveQuery(() => db.checkIns.toArray(), []);
  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);
  const [expandedAttribute, setExpandedAttribute] = useState<AttributeType | null>(null);
  const [goalStatuses, setGoalStatuses] = useState<Array<{
    goal: ActivityGoal;
    progress: GoalProgress | null;
    percentageDuration: number;
    percentageSessions: number;
    qualifiedDays?: number;
    weekDays?: GoalProgress[];
  }>>([]);

  // Carregar todas as configs
  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  // Carregar status das metas do banco
  useEffect(() => {
    if (activityGoals && activityGoals.length > 0) {
      goalRepository.getCurrentStatus().then(setGoalStatuses);
    }
  }, [activityGoals]);

  // Activity stats
  const activityXP = activities?.reduce((sum, a) => sum + a.xpEarned, 0) ?? 0;
  const activityGold = activities?.reduce((sum, a) => sum + a.goldEarned, 0) ?? 0;
  const activityDuration = activities?.reduce((sum, a) => sum + a.duration, 0) ?? 0;

  // Quest stats
  const completedQuestsList = quests?.filter(q => q.status === 'completed') ?? [];
  const completedQuests = completedQuestsList.length;
  const questXP = completedQuestsList.reduce((sum, q) => sum + q.xpReward, 0);
  const questGold = completedQuestsList.reduce((sum, q) => sum + q.goldReward, 0);
  const questDuration = completedQuestsList.reduce((sum, q) => sum + (q.estimatedDuration ?? 0), 0);
  const pendingQuests = quests?.filter(q => q.status === 'pending').length ?? 0;
  const failedQuests = quests?.filter(q => q.status === 'failed').length ?? 0;

  // Check-in stats
  const checkInXP = allCheckIns?.reduce((sum, c) => sum + c.xpEarned, 0) ?? 0;
  const checkInGold = allCheckIns?.reduce((sum, c) => sum + c.goldEarned, 0) ?? 0;

  // Combined totals
  const totalXP = activityXP + questXP + checkInXP;
  const totalGold = activityGold + questGold + checkInGold;
  const totalDuration = activityDuration + questDuration;

  // Calcular stats por atributo (atividades + quests)
  const attributeStats = (() => {
    const stats: Record<string, number> = {};

    // De atividades
    activities?.forEach(a => {
      if (a.attributeGains) {
        Object.entries(a.attributeGains).forEach(([attr, gain]) => {
          if (!stats[attr]) stats[attr] = 0;
          stats[attr] += gain as number;
        });
      }
    });

    // De quests completadas
    completedQuestsList.forEach(q => {
      if (q.attributeGains) {
        Object.entries(q.attributeGains).forEach(([attr, gain]) => {
          if (!stats[attr]) stats[attr] = 0;
          stats[attr] += gain as number;
        });
      }
    });

    // De check-ins
    allCheckIns?.forEach(c => {
      if (c.attributeGains) {
        Object.entries(c.attributeGains).forEach(([attr, gain]) => {
          if (!stats[attr]) stats[attr] = 0;
          stats[attr] += gain as number;
        });
      }
    });

    return stats;
  })();

  // Calcular stats por categoria
  const categoryStats = activities?.reduce((acc, a) => {
    if (!acc[a.category]) {
      acc[a.category] = { duration: 0, count: 0, xp: 0 };
    }
    acc[a.category].duration += a.duration;
    acc[a.category].count++;
    acc[a.category].xp += a.xpEarned;
    return acc;
  }, {} as Record<string, { duration: number; count: number; xp: number }>) ?? {};

  // Atividades dos últimos 7 dias
  const last7Days = activities?.filter(a => {
    const date = new Date(a.completedAt);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }) ?? [];

  // Quests dos últimos 7 dias
  const last7DaysQuests = completedQuestsList.filter(q => {
    if (!q.completedAt) return false;
    const date = new Date(q.completedAt);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  // Check-ins dos últimos 7 dias
  const last7DaysCheckIns = allCheckIns?.filter(c => {
    const date = new Date(c.date + 'T00:00:00');
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }) ?? [];

  const weeklyActivityXP = last7Days.reduce((sum, a) => sum + a.xpEarned, 0);
  const weeklyQuestXP = last7DaysQuests.reduce((sum, q) => sum + q.xpReward, 0);
  const weeklyCheckInXP = last7DaysCheckIns.reduce((sum, c) => sum + c.xpEarned, 0);
  const weeklyXP = weeklyActivityXP + weeklyQuestXP + weeklyCheckInXP;
  const weeklyActivityDuration = last7Days.reduce((sum, a) => sum + a.duration, 0);
  const weeklyQuestDuration = last7DaysQuests.reduce((sum, q) => sum + (q.estimatedDuration ?? 0), 0);
  const weeklyDuration = weeklyActivityDuration + weeklyQuestDuration;
  const weeklyQuestsCompleted = last7DaysQuests.length;

  // Calcular ganhos por atributo nos últimos 7 dias vs 7 dias anteriores (para tendência)
  const getAttributeTrend = (attr: AttributeType): 'up' | 'down' | 'stable' => {
    if (!activities) return 'stable';

    const now = new Date();
    const last7 = activities.filter(a => {
      const diff = (now.getTime() - new Date(a.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    const prev7 = activities.filter(a => {
      const diff = (now.getTime() - new Date(a.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diff > 7 && diff <= 14;
    });

    const lastGains = last7.reduce((sum, a) => sum + (a.attributeGains?.[attr] ?? 0), 0);
    const prevGains = prev7.reduce((sum, a) => sum + (a.attributeGains?.[attr] ?? 0), 0);

    if (lastGains > prevGains * 1.1) return 'up';
    if (lastGains < prevGains * 0.9) return 'down';
    return 'stable';
  };

  // Encontrar atividades que impactam cada atributo
  const getActivitiesForAttribute = (attr: AttributeType): { category: string; name: string; color: string; totalGain: number }[] => {
    if (!activities) return [];

    const byCategory: Record<string, number> = {};
    activities.forEach(a => {
      if (a.attributeGains?.[attr]) {
        byCategory[a.category] = (byCategory[a.category] ?? 0) + a.attributeGains[attr];
      }
    });

    return Object.entries(byCategory)
      .map(([cat, gain]) => {
        const config = allConfigs[cat] || { name: cat, color: '#6366F1' };
        return { category: cat, name: config.name, color: config.color, totalGain: gain };
      })
      .sort((a, b) => b.totalGain - a.totalGain)
      .slice(0, 5);
  };

  // Recomendar atividades para atributos baixos
  const getRecommendationsForAttribute = (attr: AttributeType): { category: string; name: string; color: string; impact: number }[] => {
    return Object.values(allConfigs)
      .filter(config => config.attributeImpacts?.some(i => i.attribute === attr))
      .map(config => {
        const impact = config.attributeImpacts.find(i => i.attribute === attr)?.gainPerMinute ?? 0;
        return { category: config.category, name: config.name, color: config.color, impact };
      })
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3);
  };

  // Identificar atributos que precisam de atenção (mais baixos)
  const getWeakAttributes = (): AttributeType[] => {
    if (!character) return [];
    return Object.values(character.attributes)
      .sort((a, b) => a.currentValue - b.currentValue)
      .slice(0, 3)
      .map(a => a.type);
  };

  const weakAttributes = getWeakAttributes();

  return (
    <div className="min-h-screen">
      <Header
        title="Analytics"
        subtitle="Analise de desempenho e evolucao"
      />

      <div className="p-6 space-y-6">
        {/* Active Debuffs Warning */}
        {activeDebuffs && activeDebuffs.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                Debuffs Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeDebuffs.map((debuff) => {
                  const remainingMs = new Date(debuff.expiresAt).getTime() - Date.now();
                  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={debuff.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                      <div>
                        <p className="font-medium text-red-400">{debuff.name}</p>
                        <p className="text-xs text-red-400/70">{debuff.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400">
                          -{Math.round((1 - debuff.multiplier) * 100)}%
                        </p>
                        <p className="text-xs text-red-400/70">
                          {remainingHours > 0 ? `${remainingHours}h ${remainingMinutes}m` : `${remainingMinutes}m`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <TrendingUp size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-accent">{totalXP.toLocaleString()}</div>
            <div className="text-xs text-gray-400">XP Total</div>
            <div className="text-[10px] text-gray-500 mt-1">
              {[
                activityXP > 0 ? `Ativ: ${activityXP.toLocaleString()}` : '',
                questXP > 0 ? `Quests: ${questXP.toLocaleString()}` : '',
                checkInXP > 0 ? `Check-ins: ${checkInXP.toLocaleString()}` : '',
              ].filter(Boolean).join(' + ')}
            </div>
          </Card>
          <Card className="text-center p-4">
            <Calendar size={24} className="mx-auto text-orange-400 mb-2" />
            <div className="text-2xl font-bold text-white">{character?.streak.current ?? 0}</div>
            <div className="text-xs text-gray-400">Streak Atual</div>
          </Card>
          <Card className="text-center p-4">
            <Target size={24} className="mx-auto text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{allCheckIns?.length ?? 0}</div>
            <div className="text-xs text-gray-400">Check-ins</div>
          </Card>
          <Card className="text-center p-4">
            <BarChart3 size={24} className="mx-auto text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
            </div>
            <div className="text-xs text-gray-400">Tempo Focado</div>
          </Card>
        </div>

        {/* Weekly Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={20} className="text-accent" />
              Progresso Semanal
            </CardTitle>
            <Badge variant="accent">{last7DaysCheckIns.length} check-ins</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                <div className="text-xl font-bold text-accent">{weeklyXP.toLocaleString()}</div>
                <div className="text-xs text-gray-400">XP esta semana</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                <div className="text-xl font-bold text-white">
                  {Math.floor(weeklyDuration / 60)}h {weeklyDuration % 60}m
                </div>
                <div className="text-xs text-gray-400">Tempo esta semana</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                <div className="text-xl font-bold text-amber-400">{totalGold.toLocaleString()}</div>
                <div className="text-xs text-gray-400">Gold total</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {[
                    activityGold > 0 ? `A: ${activityGold}` : '',
                    questGold > 0 ? `Q: ${questGold}` : '',
                    checkInGold > 0 ? `CI: ${checkInGold}` : '',
                  ].filter(Boolean).join(' + ')}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                <div className="text-xl font-bold text-green-400">{weeklyQuestsCompleted}</div>
                <div className="text-xs text-gray-400">Quests esta semana</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quest Stats */}
        {quests && quests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle size={20} className="text-green-400" />
                Estatisticas de Quests
              </CardTitle>
              <Badge variant="accent">{completedQuests} completas</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                  <div className="text-xl font-bold text-accent">{questXP.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">XP de Quests</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                  <div className="text-xl font-bold text-amber-400">{questGold.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Gold de Quests</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                  <div className="text-xl font-bold text-yellow-400">{pendingQuests}</div>
                  <div className="text-xs text-gray-400">Pendentes</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-bg-tertiary">
                  <div className="text-xl font-bold text-red-400">{failedQuests}</div>
                  <div className="text-xs text-gray-400">Falhadas</div>
                </div>
              </div>

              {/* Quest completion rate */}
              {(completedQuests + failedQuests) > 0 && (
                <div className="p-4 rounded-lg bg-bg-tertiary">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Taxa de Conclusao</span>
                    <span className="text-white font-medium">
                      {Math.round((completedQuests / (completedQuests + failedQuests)) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(completedQuests / (completedQuests + failedQuests)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle size={12} className="text-green-400" />
                      {completedQuests} completas
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle size={12} className="text-red-400" />
                      {failedQuests} falhadas
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Activity Goals Progress */}
        {goalStatuses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={20} className="text-accent" />
                Metas de Atividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {goalStatuses.map(({ goal, progress, percentageDuration, percentageSessions, qualifiedDays, weekDays }) => {
                  const config = allConfigs[goal.category] || { name: goal.category, color: '#6366F1' };
                  const currentDuration = progress?.currentDuration ?? 0;
                  const isGoalComplete = (qualifiedDays ?? 0) >= goal.targetSessions;
                  const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

                  return (
                    <div key={goal.id} className="p-4 rounded-lg bg-bg-tertiary">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{config.name}</span>
                        <Badge variant={isGoalComplete ? 'success' : 'default'}>
                          {isGoalComplete ? 'Completa' : 'Semanal'}
                        </Badge>
                      </div>

                      {/* Progresso de hoje */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Hoje (quests)</span>
                            <span>{currentDuration}/{goal.targetDuration} min</span>
                          </div>
                          <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentageDuration}%`,
                                backgroundColor: currentDuration >= goal.targetDuration ? '#22c55e' : config.color,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Dias qualificados</span>
                            <span>{qualifiedDays ?? 0}/{goal.targetSessions}</span>
                          </div>
                          <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentageSessions}%`,
                                backgroundColor: isGoalComplete ? '#22c55e' : config.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weekly tracking preview */}
                      {weekDays && weekDays.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs text-gray-500 mb-2">Semana atual</p>
                          <div className="grid grid-cols-7 gap-1">
                            {weekDays.map((day, i) => {
                              const dayDate = new Date(day.date + 'T00:00:00');
                              const dayLabel = WEEKDAY_LABELS[dayDate.getDay()];
                              const dayNum = dayDate.getDate();
                              const hasDuration = day.currentDuration > 0;
                              const hasSession = day.currentSessions > 0;
                              const dayQualified = day.isCompleted;
                              const dayFailed = day.isFailed;

                              return (
                                <div key={i} className="flex flex-col items-center gap-1">
                                  <span className="text-[10px] text-gray-500">{dayLabel}</span>
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium border ${
                                      dayQualified
                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                        : dayFailed
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : hasDuration && hasSession
                                        ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                                        : hasDuration || hasSession
                                        ? 'border-accent/50 text-accent'
                                        : 'bg-bg-primary border-border/50 text-gray-600'
                                    }`}
                                    title={`${day.currentDuration}min, ${day.currentSessions} check-in(s)${dayQualified ? ' - Qualificado!' : ''}`}
                                  >
                                    {dayNum}
                                  </div>
                                  <span className="text-[9px] text-gray-500">
                                    {hasDuration ? `${day.currentDuration}m` : ''}
                                    {hasSession ? (hasDuration ? '+' : '') + '✓' : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-sm bg-green-500/40" /> Qualificado
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-sm bg-yellow-500/40" /> Parcial
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-sm bg-bg-primary border border-border/50" /> Sem atividade
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attribute Radar */}
          {character && (
            <Card>
              <CardHeader>
                <CardTitle>Attribute Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <AttributeRadar attributes={character.attributes} size="lg" />
              </CardContent>
            </Card>
          )}

          {/* Detailed Attribute Analysis */}
          {character && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell size={20} className="text-accent" />
                  Atributos Detalhados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.values(character.attributes).map((attr) => {
                    const trend = getAttributeTrend(attr.type);
                    const isExpanded = expandedAttribute === attr.type;
                    const isWeak = weakAttributes.includes(attr.type);
                    const activityBreakdown = getActivitiesForAttribute(attr.type);
                    const recommendations = getRecommendationsForAttribute(attr.type);

                    return (
                      <div
                        key={attr.type}
                        className={`rounded-lg border transition-all ${
                          isWeak ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-bg-tertiary'
                        }`}
                      >
                        <button
                          onClick={() => setExpandedAttribute(isExpanded ? null : attr.type)}
                          className="w-full p-3 flex items-center gap-3"
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{ backgroundColor: `${attr.color}20`, color: attr.color }}
                          >
                            {Math.round(attr.currentValue)}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">{attr.name}</span>
                              {isWeak && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                                  Precisa Atencao
                                </span>
                              )}
                              {trend === 'up' && <TrendingUp size={14} className="text-green-400" />}
                              {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
                            </div>
                            <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.round(attr.currentValue))}%`, backgroundColor: attr.color }}
                              />
                            </div>
                          </div>
                          <div className="text-gray-500">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-4 border-t border-border/50 pt-3">
                            {/* Trend Info */}
                            <div className="flex items-center gap-2 text-sm">
                              {trend === 'up' && (
                                <>
                                  <TrendingUp size={16} className="text-green-400" />
                                  <span className="text-green-400">Melhorando esta semana</span>
                                </>
                              )}
                              {trend === 'down' && (
                                <>
                                  <TrendingDown size={16} className="text-red-400" />
                                  <span className="text-red-400">Precisa de mais atencao</span>
                                </>
                              )}
                              {trend === 'stable' && (
                                <>
                                  <Info size={16} className="text-gray-400" />
                                  <span className="text-gray-400">Estavel</span>
                                </>
                              )}
                            </div>

                            {/* Activity Breakdown */}
                            {activityBreakdown.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 mb-2">Atividades que mais contribuem:</p>
                                <div className="space-y-2">
                                  {activityBreakdown.map(act => (
                                    <div key={act.category} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: act.color }}
                                        />
                                        <span className="text-sm text-gray-300">{act.name}</span>
                                      </div>
                                      <span className="text-xs text-accent">+{act.totalGain.toFixed(1)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recommendations */}
                            {recommendations.length > 0 && isWeak && (
                              <div className="p-2 rounded bg-accent/10 border border-accent/20">
                                <p className="text-xs text-accent mb-2 font-medium">Recomendacoes para melhorar:</p>
                                <div className="flex flex-wrap gap-2">
                                  {recommendations.map(rec => (
                                    <span
                                      key={rec.category}
                                      className="px-2 py-1 text-xs rounded"
                                      style={{ backgroundColor: `${rec.color}20`, color: rec.color }}
                                    >
                                      {rec.name} (+{rec.impact.toFixed(2)}/min)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {activityBreakdown.length === 0 && (
                              <p className="text-sm text-gray-500">
                                Nenhuma atividade registrada que impacta este atributo ainda.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Attribute Gains from Activities */}
        {Object.keys(attributeStats).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award size={20} className="text-accent" />
                Ganhos de Atributos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {Object.entries(attributeStats)
                  .sort(([, a], [, b]) => b - a)
                  .map(([attr, gain]) => {
                    const attrInfo = INITIAL_ATTRIBUTES[attr as AttributeType];
                    if (!attrInfo) return null;
                    return (
                      <div key={attr} className="text-center p-4 rounded-lg bg-bg-tertiary">
                        <div className="text-xl font-bold" style={{ color: attrInfo.color }}>
                          +{gain.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-400">{attrInfo.name}</div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Breakdown */}
        {Object.keys(categoryStats).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Breakdown por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(categoryStats)
                  .sort(([, a], [, b]) => b.duration - a.duration)
                  .map(([cat, stats]) => {
                    const config = allConfigs[cat] || { name: cat, color: '#6366F1' };
                    const totalPercent = totalDuration > 0 ? (stats.duration / totalDuration) * 100 : 0;

                    return (
                      <div key={cat} className="p-4 rounded-lg bg-bg-tertiary">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                            <span className="font-medium text-white">{config.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-400">{stats.count} sessoes</span>
                            <span className="text-accent">+{stats.xp} XP</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${totalPercent}%`,
                                backgroundColor: config.color,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-20 text-right">
                            {Math.floor(stats.duration / 60)}h {stats.duration % 60}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* XP Events Timeline */}
        {xpEvents && xpEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={20} className="text-accent" />
                Historico de XP
              </CardTitle>
              <Badge variant="accent">{xpEvents.length} eventos</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
                {xpEvents.map((event) => {
                  const isQuest = event.source === 'quest';
                  const isActivity = event.source === 'activity';
                  const isCheckIn = event.source === 'check-in';
                  const isNegative = event.amount < 0;
                  const date = new Date(event.timestamp);
                  const today = new Date();
                  const isToday = date.toDateString() === today.toDateString();

                  return (
                    <div
                      key={event.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isNegative ? 'bg-red-500/5 border border-red-500/20' : 'bg-bg-tertiary'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isQuest
                              ? 'bg-green-500/20 text-green-400'
                              : isCheckIn
                              ? 'bg-orange-500/20 text-orange-400'
                              : isActivity
                              ? 'bg-accent/20 text-accent'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {isQuest ? (
                            <CheckCircle size={16} />
                          ) : isCheckIn ? (
                            <Zap size={16} />
                          ) : isActivity ? (
                            <Target size={16} />
                          ) : (
                            <Award size={16} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-white">{event.description}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isQuest
                                ? 'bg-green-500/20 text-green-400'
                                : isCheckIn
                                ? 'bg-orange-500/20 text-orange-400'
                                : isActivity
                                ? 'bg-accent/20 text-accent'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {isQuest ? 'Quest' : isCheckIn ? 'Check-in' : isActivity ? 'Atividade' : event.source}
                            </span>
                            <span className="text-xs text-gray-500">
                              {isToday ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        isNegative ? 'text-red-400' : 'text-accent'
                      }`}>
                        {isNegative ? '' : '+'}{event.amount} XP
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Report Placeholder */}
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} className="text-accent" />
              Relatorio Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">
              O relatorio semanal sera gerado automaticamente aos domingos com analise
              detalhada do seu progresso, insights de IA e recomendacoes personalizadas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
