import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { Objective, ObjectiveTimeframe, ObjectiveStatus, Milestone, ActivityCategory } from '@/types';
import { XP_REWARDS, GOLD_REWARDS } from '@/features/gamification/constants';
import { characterRepository } from './characterRepository';

interface CreateObjectiveInput {
  title: string;
  description?: string;
  timeframe: ObjectiveTimeframe;
  targetDate: string;
  milestones?: { title: string }[];
  relatedActivities?: ActivityCategory[];
}

interface UpdateObjectiveInput {
  title?: string;
  description?: string;
  timeframe?: ObjectiveTimeframe;
  targetDate?: string;
  relatedActivities?: ActivityCategory[];
  status?: ObjectiveStatus;
}

interface CompleteObjectiveResult {
  objective: Objective;
  xpEarned: number;
  goldEarned: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
}

interface CompleteMilestoneResult {
  milestone: Milestone;
  xpEarned: number;
  newProgress: number;
}

const TIMEFRAME_XP_MAP: Record<ObjectiveTimeframe, number> = {
  short: XP_REWARDS.COMPLETE_OBJECTIVE_SHORT,
  medium: XP_REWARDS.COMPLETE_OBJECTIVE_MEDIUM,
  long: XP_REWARDS.COMPLETE_OBJECTIVE_LONG,
};

const TIMEFRAME_GOLD_MAP: Record<ObjectiveTimeframe, number> = {
  short: GOLD_REWARDS.COMPLETE_OBJECTIVE_SHORT,
  medium: GOLD_REWARDS.COMPLETE_OBJECTIVE_MEDIUM,
  long: GOLD_REWARDS.COMPLETE_OBJECTIVE_LONG,
};

export const objectiveRepository = {
  async getById(id: string): Promise<Objective | undefined> {
    return db.objectives.get(id);
  },

  async getAll(): Promise<Objective[]> {
    return db.objectives.toArray();
  },

  async getByStatus(status: ObjectiveStatus): Promise<Objective[]> {
    return db.objectives.where('status').equals(status).toArray();
  },

  async getByTimeframe(timeframe: ObjectiveTimeframe): Promise<Objective[]> {
    return db.objectives.where('timeframe').equals(timeframe).toArray();
  },

  async getActive(): Promise<Objective[]> {
    return db.objectives.where('status').equals('active').toArray();
  },

  async create(input: CreateObjectiveInput): Promise<Objective> {
    const now = new Date().toISOString();

    const milestones: Milestone[] = (input.milestones || []).map((m, index) => ({
      id: uuid(),
      title: m.title,
      isCompleted: false,
      order: index,
    }));

    const objective: Objective = {
      id: uuid(),
      title: input.title,
      description: input.description,
      timeframe: input.timeframe,
      status: 'active',
      progress: 0,
      milestones,
      startDate: now,
      targetDate: input.targetDate,
      xpReward: TIMEFRAME_XP_MAP[input.timeframe],
      relatedActivities: input.relatedActivities,
      createdAt: now,
      updatedAt: now,
    };

    await db.objectives.add(objective);
    return objective;
  },

  async update(id: string, updates: UpdateObjectiveInput): Promise<Objective> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Objective not found');

    const updatedObjective: Objective = {
      ...existing,
      ...updates,
      // Recalcular XP se timeframe mudar
      xpReward: updates.timeframe
        ? TIMEFRAME_XP_MAP[updates.timeframe]
        : existing.xpReward,
      updatedAt: new Date().toISOString(),
    };

    await db.objectives.put(updatedObjective);
    return updatedObjective;
  },

  async addMilestone(objectiveId: string, title: string): Promise<Milestone> {
    const objective = await this.getById(objectiveId);
    if (!objective) throw new Error('Objective not found');

    const newMilestone: Milestone = {
      id: uuid(),
      title,
      isCompleted: false,
      order: objective.milestones.length,
    };

    const updatedMilestones = [...objective.milestones, newMilestone];

    // Recalcular progresso
    const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
    const newProgress = updatedMilestones.length > 0
      ? Math.round((completedCount / updatedMilestones.length) * 100)
      : 0;

    await db.objectives.update(objectiveId, {
      milestones: updatedMilestones,
      progress: newProgress,
      updatedAt: new Date().toISOString(),
    });

    return newMilestone;
  },

  async removeMilestone(objectiveId: string, milestoneId: string): Promise<void> {
    const objective = await this.getById(objectiveId);
    if (!objective) throw new Error('Objective not found');

    const updatedMilestones = objective.milestones
      .filter(m => m.id !== milestoneId)
      .map((m, index) => ({ ...m, order: index }));

    // Recalcular progresso
    const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
    const newProgress = updatedMilestones.length > 0
      ? Math.round((completedCount / updatedMilestones.length) * 100)
      : 0;

    await db.objectives.update(objectiveId, {
      milestones: updatedMilestones,
      progress: newProgress,
      updatedAt: new Date().toISOString(),
    });
  },

  async completeMilestone(objectiveId: string, milestoneId: string): Promise<CompleteMilestoneResult> {
    const objective = await this.getById(objectiveId);
    if (!objective) throw new Error('Objective not found');

    const milestoneIndex = objective.milestones.findIndex(m => m.id === milestoneId);
    if (milestoneIndex === -1) throw new Error('Milestone not found');

    const milestone = objective.milestones[milestoneIndex];
    if (milestone.isCompleted) throw new Error('Milestone already completed');

    const now = new Date().toISOString();
    const updatedMilestones = [...objective.milestones];
    updatedMilestones[milestoneIndex] = {
      ...milestone,
      isCompleted: true,
      completedAt: now,
    };

    // Calcular novo progresso
    const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
    const newProgress = Math.round((completedCount / updatedMilestones.length) * 100);

    await db.objectives.update(objectiveId, {
      milestones: updatedMilestones,
      progress: newProgress,
      updatedAt: now,
    });

    // Dar XP pela milestone
    const xpEarned = XP_REWARDS.COMPLETE_MILESTONE;
    await characterRepository.addXP(xpEarned);

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'objective',
      sourceId: objectiveId,
      amount: xpEarned,
      description: `Milestone: ${milestone.title}`,
      timestamp: now,
    });

    return {
      milestone: updatedMilestones[milestoneIndex],
      xpEarned,
      newProgress,
    };
  },

  async uncompleteMilestone(objectiveId: string, milestoneId: string): Promise<void> {
    const objective = await this.getById(objectiveId);
    if (!objective) throw new Error('Objective not found');

    const milestoneIndex = objective.milestones.findIndex(m => m.id === milestoneId);
    if (milestoneIndex === -1) throw new Error('Milestone not found');

    const updatedMilestones = [...objective.milestones];
    updatedMilestones[milestoneIndex] = {
      ...updatedMilestones[milestoneIndex],
      isCompleted: false,
      completedAt: undefined,
    };

    // Recalcular progresso
    const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
    const newProgress = updatedMilestones.length > 0
      ? Math.round((completedCount / updatedMilestones.length) * 100)
      : 0;

    await db.objectives.update(objectiveId, {
      milestones: updatedMilestones,
      progress: newProgress,
      updatedAt: new Date().toISOString(),
    });
  },

  async complete(id: string): Promise<CompleteObjectiveResult> {
    const objective = await this.getById(id);
    if (!objective) throw new Error('Objective not found');
    if (objective.status === 'completed') throw new Error('Objective already completed');

    const now = new Date().toISOString();

    // Marcar todas as milestones como completas
    const completedMilestones = objective.milestones.map(m => ({
      ...m,
      isCompleted: true,
      completedAt: m.completedAt || now,
    }));

    const completedObjective: Objective = {
      ...objective,
      status: 'completed',
      progress: 100,
      milestones: completedMilestones,
      completedAt: now,
      updatedAt: now,
    };

    await db.objectives.put(completedObjective);

    // Dar recompensas
    const xpEarned = TIMEFRAME_XP_MAP[objective.timeframe];
    const goldEarned = TIMEFRAME_GOLD_MAP[objective.timeframe];

    const xpResult = await characterRepository.addXP(xpEarned);
    await characterRepository.addGold(goldEarned);

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'objective',
      sourceId: objective.id,
      amount: xpEarned,
      description: `Objetivo completo: ${objective.title}`,
      timestamp: now,
    });

    return {
      objective: completedObjective,
      xpEarned,
      goldEarned,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
      newTitle: xpResult.newTitle,
    };
  },

  async pause(id: string): Promise<void> {
    await db.objectives.update(id, {
      status: 'paused',
      updatedAt: new Date().toISOString(),
    });
  },

  async resume(id: string): Promise<void> {
    await db.objectives.update(id, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
  },

  async abandon(id: string): Promise<void> {
    await db.objectives.update(id, {
      status: 'abandoned',
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.objectives.delete(id);
  },

  async updateProgress(id: string, progress: number): Promise<void> {
    await db.objectives.update(id, {
      progress: Math.max(0, Math.min(100, progress)),
      updatedAt: new Date().toISOString(),
    });
  },

  async getStats() {
    const objectives = await this.getAll();

    return {
      total: objectives.length,
      active: objectives.filter(o => o.status === 'active').length,
      completed: objectives.filter(o => o.status === 'completed').length,
      paused: objectives.filter(o => o.status === 'paused').length,
      abandoned: objectives.filter(o => o.status === 'abandoned').length,
      byTimeframe: {
        short: objectives.filter(o => o.timeframe === 'short').length,
        medium: objectives.filter(o => o.timeframe === 'medium').length,
        long: objectives.filter(o => o.timeframe === 'long').length,
      },
    };
  },
};
