import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { ActivityGoal, GoalProgress, ActivityCategory, Debuff } from '@/types';
import { debuffRepository } from './debuffRepository';

interface CreateGoalInput {
  category: ActivityCategory;
  targetDuration: number; // minutos POR DIA
  targetSessions: number; // dias qualificados por semana
}

export const goalRepository = {
  async getById(id: string): Promise<ActivityGoal | undefined> {
    return db.activityGoals.get(id);
  },

  async getAll(): Promise<ActivityGoal[]> {
    return db.activityGoals.toArray();
  },

  async getActive(): Promise<ActivityGoal[]> {
    const all = await db.activityGoals.toArray();
    return all.filter(g => g.isActive);
  },

  async getByCategory(category: ActivityCategory): Promise<ActivityGoal[]> {
    try {
      return await db.activityGoals.where('category').equals(category).toArray();
    } catch {
      return [];
    }
  },

  async create(input: CreateGoalInput): Promise<ActivityGoal> {
    const now = new Date().toISOString();

    // Desativar metas existentes da mesma categoria
    const existing = await db.activityGoals
      .where('category')
      .equals(input.category)
      .toArray();

    for (const goal of existing) {
      await db.activityGoals.update(goal.id, { isActive: false });
    }

    const goal: ActivityGoal = {
      id: uuid(),
      category: input.category,
      recurrence: 'weekly',
      targetDuration: input.targetDuration,
      targetSessions: input.targetSessions,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.activityGoals.add(goal);
    return goal;
  },

  async update(id: string, updates: Partial<CreateGoalInput>): Promise<void> {
    await db.activityGoals.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.activityGoals.delete(id);
  },

  async toggleActive(id: string): Promise<void> {
    const goal = await this.getById(id);
    if (goal) {
      await db.activityGoals.update(id, { isActive: !goal.isActive });
    }
  },

  // Progresso - SEMPRE rastreia por dia
  async getProgress(goalId: string, date: string): Promise<GoalProgress | undefined> {
    return db.goalProgress.where('[goalId+date]').equals([goalId, date]).first();
  },

  // Atualiza progresso do DIA ATUAL
  // duration: minutos de quests completadas
  // sessions: 1 = check-in feito, 0 = sem check-in
  // Um dia é "qualificado" quando: duration >= targetDuration AND sessions >= 1
  async updateProgress(goalId: string, duration: number, sessions: number): Promise<GoalProgress | null> {
    try {
      const goal = await this.getById(goalId);
      if (!goal) return null;

      // SEMPRE usa dateKey diário, mesmo para metas semanais
      const dateKey = getLocalDateString();

      let progress = await this.getProgress(goalId, dateKey);

      if (progress) {
        const newDuration = Math.max(0, progress.currentDuration + duration);
        const newSessions = Math.max(0, progress.currentSessions + sessions);
        // Dia qualificado: tem check-in E atingiu a duração mínima
        const isCompleted = newDuration >= goal.targetDuration && newSessions >= 1;

        await db.goalProgress.update([goalId, dateKey] as any, {
          currentDuration: newDuration,
          currentSessions: newSessions,
          isCompleted,
        });

        progress = {
          ...progress,
          currentDuration: newDuration,
          currentSessions: newSessions,
          isCompleted,
        };
      } else {
        const safeDuration = Math.max(0, duration);
        const safeSessions = Math.max(0, sessions);
        const isCompleted = safeDuration >= goal.targetDuration && safeSessions >= 1;
        progress = {
          goalId,
          date: dateKey,
          currentDuration: safeDuration,
          currentSessions: safeSessions,
          isCompleted,
          isFailed: false,
        };
        await db.goalProgress.add(progress);
      }

      return progress;
    } catch {
      return null;
    }
  },

  // Conta dias qualificados na semana atual para uma meta
  async getWeekQualifiedDays(goalId: string): Promise<{ qualified: number; days: GoalProgress[] }> {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Domingo

    const days: GoalProgress[] = [];
    let qualified = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateKey = getLocalDateString(d);

      // Não contar dias futuros
      if (dateKey > getLocalDateString()) break;

      const progress = await this.getProgress(goalId, dateKey);
      const dayProgress: GoalProgress = progress || {
        goalId,
        date: dateKey,
        currentDuration: 0,
        currentSessions: 0,
        isCompleted: false,
        isFailed: false,
      };

      days.push(dayProgress);
      if (dayProgress.isCompleted) qualified++;
    }

    return { qualified, days };
  },

  // Verificação de metas não cumpridas
  async checkFailedGoals(): Promise<Debuff[]> {
    const activeGoals = await this.getActive();
    const debuffsApplied: Debuff[] = [];

    for (const goal of activeGoals) {
      // Verificar se a semana passada teve dias qualificados suficientes
      const today = new Date();
      if (today.getDay() === 0) { // Só checa no domingo (início da nova semana)
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        let qualifiedDays = 0;
        let alreadyFailed = false;

        for (let i = 0; i < 7; i++) {
          const d = new Date(lastWeekStart);
          d.setDate(d.getDate() + i);
          const dateKey = getLocalDateString(d);
          const progress = await this.getProgress(goal.id, dateKey);

          if (progress) {
            if (progress.isCompleted) qualifiedDays++;
            if (progress.isFailed) alreadyFailed = true;
          }
        }

        if (!alreadyFailed && qualifiedDays < goal.targetSessions) {
          // Marcar último dia da semana como falho
          const lastDay = new Date(lastWeekStart);
          lastDay.setDate(lastDay.getDate() + 6);
          const lastDayKey = getLocalDateString(lastDay);

          const existing = await this.getProgress(goal.id, lastDayKey);
          if (existing) {
            await db.goalProgress.update([goal.id, lastDayKey] as any, { isFailed: true });
          } else {
            await db.goalProgress.add({
              goalId: goal.id,
              date: lastDayKey,
              currentDuration: 0,
              currentSessions: 0,
              isCompleted: false,
              isFailed: true,
            });
          }

          const debuff = await debuffRepository.applyDebuff({
            type: 'xp_reduction',
            severity: 1,
            sourceGoalId: goal.id,
            durationHours: 168, // 1 semana
          });
          debuffsApplied.push(debuff);
        }
      }
    }

    return debuffsApplied;
  },

  // Helpers
  getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return getLocalDateString(d);
  },

  getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  },

  getLastWeekKey(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 7);
    return this.getWeekKey(d);
  },

  // Obter status atual de todas as metas ativas
  async getCurrentStatus(): Promise<Array<{
    goal: ActivityGoal;
    progress: GoalProgress | null;
    percentageDuration: number;
    percentageSessions: number;
    qualifiedDays?: number;
    weekDays?: GoalProgress[];
  }>> {
    const activeGoals = await this.getActive();
    const result = [];

    for (const goal of activeGoals) {
      const todayKey = getLocalDateString();
      const todayProgress = await this.getProgress(goal.id, todayKey) || null;

      // Contar dias qualificados na semana
      const { qualified, days } = await this.getWeekQualifiedDays(goal.id);

      result.push({
        goal,
        progress: todayProgress,
        percentageDuration: todayProgress
          ? Math.min(100, Math.round((todayProgress.currentDuration / goal.targetDuration) * 100))
          : 0,
        percentageSessions: Math.min(100, Math.round((qualified / goal.targetSessions) * 100)),
        qualifiedDays: qualified,
        weekDays: days,
      });
    }

    return result;
  },
};
