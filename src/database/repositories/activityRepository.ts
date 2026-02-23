import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { ActivityLog, ActivityCategory, AttributeType } from '@/types';
import {
  getStreakMultiplier,
  DIFFICULTY_MULTIPLIERS,
} from '@/features/gamification/constants';
import { characterRepository } from './characterRepository';
import { debuffRepository } from './debuffRepository';
import { categoryRepository } from './categoryRepository';

interface LogActivityInput {
  category: ActivityCategory;
  duration: number;
  notes?: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface LogActivityResult {
  activity: ActivityLog;
  xpEarned: number;
  goldEarned: number;
  attributeGains: Partial<Record<AttributeType, number>>;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
  debuffApplied: boolean;
  xpReduction: number;
  goldReduction: number;
}

export const activityRepository = {
  async getById(id: string): Promise<ActivityLog | undefined> {
    return db.activities.get(id);
  },

  async getAll(limit = 100): Promise<ActivityLog[]> {
    return db.activities.orderBy('completedAt').reverse().limit(limit).toArray();
  },

  async getByCategory(category: ActivityCategory, limit = 50): Promise<ActivityLog[]> {
    return db.activities
      .where('category')
      .equals(category)
      .reverse()
      .sortBy('completedAt')
      .then(activities => activities.slice(0, limit));
  },

  async getByDateRange(startDate: string, endDate: string): Promise<ActivityLog[]> {
    return db.activities
      .where('completedAt')
      .between(startDate, endDate, true, true)
      .toArray();
  },

  async getTodayActivities(): Promise<ActivityLog[]> {
    const today = getLocalDateString();
    return db.activities
      .where('completedAt')
      .startsWith(today)
      .toArray();
  },

  async logActivity(input: LogActivityInput): Promise<LogActivityResult> {
    // Buscar config (padrão ou customizada)
    const allConfigs = await categoryRepository.getAllActivityConfigs();
    const config = allConfigs[input.category];

    if (!config) {
      throw new Error(`Categoria "${input.category}" não encontrada`);
    }

    const character = await characterRepository.get();

    if (!character) {
      throw new Error('Character not found. Please create a character first.');
    }

    // Calcular XP base
    const baseXP = config.baseXP + (input.duration * config.xpPerMinute);

    // Aplicar multiplicadores
    const streakMultiplier = getStreakMultiplier(character.streak.current);
    const difficultyMultiplier = input.difficulty
      ? DIFFICULTY_MULTIPLIERS[input.difficulty]
      : 1;

    // Bonus por quantidade de atributos impactados
    // 1 attr = 1x, 2 attrs = 1.1x, 3 attrs = 1.2x, 4+ attrs = 1.3x
    const attributeCount = config.attributeImpacts?.length ?? 1;
    const attributeBonus = attributeCount >= 4 ? 1.3 :
                           attributeCount >= 3 ? 1.2 :
                           attributeCount >= 2 ? 1.1 : 1.0;

    let totalXP = Math.floor(baseXP * streakMultiplier * difficultyMultiplier * attributeBonus);
    let goldEarned = Math.floor(config.goldPerSession * attributeBonus);

    // Aplicar debuffs (redução de XP/Gold)
    const debuffMultipliers = await debuffRepository.getAllMultipliers();
    const xpBeforeDebuff = totalXP;
    const goldBeforeDebuff = goldEarned;

    totalXP = Math.floor(totalXP * debuffMultipliers.xp);
    goldEarned = Math.floor(goldEarned * debuffMultipliers.gold);

    const xpReduction = xpBeforeDebuff - totalXP;
    const goldReduction = goldBeforeDebuff - goldEarned;
    const debuffApplied = xpReduction > 0 || goldReduction > 0;

    // Calcular ganhos de atributos (também afetado por debuffs)
    const attributeGains: Partial<Record<AttributeType, number>> = {};
    for (const impact of config.attributeImpacts) {
      const gain = input.duration * impact.gainPerMinute * difficultyMultiplier * debuffMultipliers.attributes;
      attributeGains[impact.attribute] = Math.round(gain * 100) / 100;
    }

    // Criar log de atividade
    const now = new Date().toISOString();
    const activity: ActivityLog = {
      id: uuid(),
      category: input.category,
      duration: input.duration,
      xpEarned: totalXP,
      goldEarned,
      attributeGains,
      notes: input.notes,
      mood: input.mood,
      difficulty: input.difficulty,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Salvar no banco
    await db.activities.add(activity);

    // Atualizar personagem
    const xpResult = await characterRepository.addXP(totalXP);
    await characterRepository.addGold(goldEarned);
    await characterRepository.updateMultipleAttributes(attributeGains);
    await characterRepository.updateStreak();

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'activity',
      sourceId: activity.id,
      amount: totalXP,
      description: `${config.name} - ${input.duration} minutos${debuffApplied ? ' (debuff aplicado)' : ''}`,
      timestamp: now,
    });

    return {
      activity,
      xpEarned: totalXP,
      goldEarned,
      attributeGains,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
      newTitle: xpResult.newTitle,
      debuffApplied,
      xpReduction,
      goldReduction,
    };
  },

  async update(id: string, input: Partial<LogActivityInput>): Promise<ActivityLog> {
    const existing = await db.activities.get(id);
    if (!existing) {
      throw new Error('Activity not found');
    }

    const allConfigs = await categoryRepository.getAllActivityConfigs();
    const config = allConfigs[input.category ?? existing.category];

    if (!config) {
      throw new Error('Categoria não encontrada');
    }

    const character = await characterRepository.get();

    if (!character) {
      throw new Error('Character not found');
    }

    // Recalcular XP se duração ou dificuldade mudou
    const duration = input.duration ?? existing.duration;
    const difficulty = input.difficulty ?? existing.difficulty ?? 'medium';

    const baseXP = config.baseXP + (duration * config.xpPerMinute);
    const streakMultiplier = getStreakMultiplier(character.streak.current);
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty];

    // Bonus por quantidade de atributos
    const attributeCount = config.attributeImpacts?.length ?? 1;
    const attributeBonus = attributeCount >= 4 ? 1.3 :
                           attributeCount >= 3 ? 1.2 :
                           attributeCount >= 2 ? 1.1 : 1.0;

    const totalXP = Math.floor(baseXP * streakMultiplier * difficultyMultiplier * attributeBonus);
    const goldEarned = Math.floor(config.goldPerSession * attributeBonus);

    // Calcular ganhos de atributos
    const attributeGains: Partial<Record<AttributeType, number>> = {};
    for (const impact of config.attributeImpacts) {
      const gain = duration * impact.gainPerMinute * difficultyMultiplier;
      attributeGains[impact.attribute] = Math.round(gain * 100) / 100;
    }

    const updated: ActivityLog = {
      ...existing,
      category: input.category ?? existing.category,
      duration,
      difficulty,
      mood: input.mood ?? existing.mood,
      notes: input.notes ?? existing.notes,
      xpEarned: totalXP,
      goldEarned,
      attributeGains,
      updatedAt: new Date().toISOString(),
    };

    await db.activities.put(updated);
    return updated;
  },

  async delete(id: string): Promise<{ xpLost: number; goldLost: number; attributesLost: Partial<Record<AttributeType, number>> }> {
    const activity = await this.getById(id);
    if (!activity) throw new Error('Activity not found');

    const xpLost = activity.xpEarned;
    const goldLost = activity.goldEarned;
    const attributesLost = activity.attributeGains;

    // Remover XP e Gold
    await characterRepository.removeXP(xpLost);
    await characterRepository.removeGold(goldLost);

    // Remover ganhos de atributos
    if (attributesLost && Object.keys(attributesLost).length > 0) {
      const negativeGains: Partial<Record<AttributeType, number>> = {};
      for (const [attr, gain] of Object.entries(attributesLost)) {
        if (gain) negativeGains[attr as AttributeType] = -gain;
      }
      await characterRepository.updateMultipleAttributes(negativeGains);
    }

    // Registrar evento de XP negativo
    await db.xpEvents.add({
      id: uuid(),
      source: 'activity',
      sourceId: activity.id,
      amount: -xpLost,
      description: `Atividade removida: ${activity.category}`,
      timestamp: new Date().toISOString(),
    });

    await db.activities.delete(id);
    return { xpLost, goldLost, attributesLost: attributesLost || {} };
  },

  async getStats(startDate: string, endDate: string) {
    const activities = await this.getByDateRange(startDate, endDate);

    const stats = {
      totalDuration: 0,
      totalXP: 0,
      totalGold: 0,
      count: activities.length,
      byCategory: {} as Record<ActivityCategory, {
        duration: number;
        count: number;
        xp: number;
        gold: number;
      }>,
    };

    for (const activity of activities) {
      stats.totalDuration += activity.duration;
      stats.totalXP += activity.xpEarned;
      stats.totalGold += activity.goldEarned;

      if (!stats.byCategory[activity.category]) {
        stats.byCategory[activity.category] = {
          duration: 0,
          count: 0,
          xp: 0,
          gold: 0,
        };
      }

      stats.byCategory[activity.category].duration += activity.duration;
      stats.byCategory[activity.category].count++;
      stats.byCategory[activity.category].xp += activity.xpEarned;
      stats.byCategory[activity.category].gold += activity.goldEarned;
    }

    return stats;
  },
};
