import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { Quest, QuestCategory, QuestDifficulty, QuestRecurrence, QuestStatus, AttributeType } from '@/types';
import { XP_REWARDS, GOLD_REWARDS, XP_PENALTIES, GOLD_PENALTIES, CATEGORY_MULTIPLIERS } from '@/features/gamification/constants';
import { characterRepository } from './characterRepository';
import { categoryRepository } from './categoryRepository';
import { goalRepository } from './goalRepository';
import { debuffRepository } from './debuffRepository';

interface CreateQuestInput {
  title: string;
  description?: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  recurrence: QuestRecurrence;
  scheduledDate: string;
  relatedActivity?: string;
  estimatedDuration?: number | null;
}

interface CompleteQuestResult {
  quest: Quest;
  xpEarned: number;
  goldEarned: number;
  attributeGains: Partial<Record<AttributeType, number>>;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
  streakBonus: number;
  streakCount: number;
}

// Ganho base de atributo por dificuldade de quest
const DIFFICULTY_ATTRIBUTE_GAIN: Record<QuestDifficulty, number> = {
  easy: 0.5,
  medium: 1.0,
  hard: 2.0,
};

const DIFFICULTY_XP_MAP: Record<QuestDifficulty, number> = {
  easy: XP_REWARDS.COMPLETE_QUEST_EASY,
  medium: XP_REWARDS.COMPLETE_QUEST_MEDIUM,
  hard: XP_REWARDS.COMPLETE_QUEST_HARD,
};

const DIFFICULTY_GOLD_MAP: Record<QuestDifficulty, number> = {
  easy: GOLD_REWARDS.COMPLETE_QUEST_EASY,
  medium: GOLD_REWARDS.COMPLETE_QUEST_MEDIUM,
  hard: GOLD_REWARDS.COMPLETE_QUEST_HARD,
};

const DIFFICULTY_XP_PENALTY_MAP: Record<QuestDifficulty, number> = {
  easy: XP_PENALTIES.FAIL_QUEST_EASY,
  medium: XP_PENALTIES.FAIL_QUEST_MEDIUM,
  hard: XP_PENALTIES.FAIL_QUEST_HARD,
};

const DIFFICULTY_GOLD_PENALTY_MAP: Record<QuestDifficulty, number> = {
  easy: GOLD_PENALTIES.FAIL_QUEST_EASY,
  medium: GOLD_PENALTIES.FAIL_QUEST_MEDIUM,
  hard: GOLD_PENALTIES.FAIL_QUEST_HARD,
};

export const questRepository = {
  async getById(id: string): Promise<Quest | undefined> {
    return db.quests.get(id);
  },

  async getAll(): Promise<Quest[]> {
    return db.quests.toArray();
  },

  async getByStatus(status: QuestStatus): Promise<Quest[]> {
    return db.quests.where('status').equals(status).toArray();
  },

  async getByDate(date: string): Promise<Quest[]> {
    return db.quests.where('scheduledDate').equals(date).toArray();
  },

  async getTodayQuests(): Promise<Quest[]> {
    const today = getLocalDateString();
    return this.getByDate(today);
  },

  async create(input: CreateQuestInput): Promise<Quest> {
    const now = new Date().toISOString();

    // Base rewards por dificuldade
    let xpReward = DIFFICULTY_XP_MAP[input.difficulty];
    let goldReward = DIFFICULTY_GOLD_MAP[input.difficulty];

    // Aplicar multiplicador de categoria (main > daily > side)
    const categoryMultiplier = CATEGORY_MULTIPLIERS[input.category] ?? 1.0;
    xpReward = Math.floor(xpReward * categoryMultiplier);
    goldReward = Math.floor(goldReward * categoryMultiplier);

    // Aplicar bonus se tiver atividade relacionada com múltiplos atributos
    if (input.relatedActivity) {
      const allConfigs = await categoryRepository.getAllActivityConfigs();
      const activityConfig = allConfigs[input.relatedActivity];

      if (activityConfig && activityConfig.attributeImpacts) {
        const attributeCount = activityConfig.attributeImpacts.length;
        // Bonus: 1 attr = 1x, 2 attrs = 1.1x, 3 attrs = 1.2x, 4+ attrs = 1.3x
        const attributeBonus = attributeCount >= 4 ? 1.3 :
                               attributeCount >= 3 ? 1.2 :
                               attributeCount >= 2 ? 1.1 : 1.0;

        xpReward = Math.floor(xpReward * attributeBonus);
        goldReward = Math.floor(goldReward * attributeBonus);
      }
    }

    const quest: Quest = {
      id: uuid(),
      title: input.title,
      description: input.description,
      category: input.category,
      difficulty: input.difficulty,
      status: 'pending',
      recurrence: input.recurrence,
      scheduledDate: input.scheduledDate,
      estimatedDuration: input.estimatedDuration,
      xpReward,
      goldReward,
      relatedActivity: input.relatedActivity as any,
      createdAt: now,
      updatedAt: now,
    };

    await db.quests.add(quest);
    return quest;
  },

  async update(id: string, updates: Partial<Quest>): Promise<void> {
    await db.quests.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async complete(id: string, notes?: string): Promise<CompleteQuestResult> {
    const quest = await this.getById(id);
    if (!quest) throw new Error('Quest not found');
    if (quest.status === 'completed') throw new Error('Quest already completed');

    const now = new Date().toISOString();

    // Buscar multiplicadores de debuff
    const debuffMultipliers = await debuffRepository.getAllMultipliers();

    // Streak bonus: +5% por quest completada nos últimos 7 dias, max 1.5x
    // Só conta quests após a criação do personagem (reseta ao resetar o personagem)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);
    const character = await characterRepository.get();
    const characterCreatedDate = character?.createdAt.split('T')[0] ?? sevenDaysAgoStr;
    const countFromDate = characterCreatedDate > sevenDaysAgoStr ? characterCreatedDate : sevenDaysAgoStr;
    const recentCompleted = await db.quests
      .where('status')
      .equals('completed')
      .filter(q => (q.completedAt ?? '') >= countFromDate)
      .count();
    const streakBonus = Math.min(1.5, 1 + recentCompleted * 0.05);

    // Dar recompensas de XP e Gold (com debuff e streak bonus)
    const xpAfterDebuff = Math.floor(quest.xpReward * debuffMultipliers.xp * streakBonus);
    const goldAfterDebuff = Math.floor(quest.goldReward * debuffMultipliers.gold * streakBonus);
    const xpResult = await characterRepository.addXP(xpAfterDebuff, { source: 'quest', label: quest.title });
    await characterRepository.addGold(goldAfterDebuff);

    // Streak - não deve impedir a conclusão da quest
    try {
      await characterRepository.updateStreak();
    } catch (e) {
      console.error('Failed to update streak:', e);
    }

    // Calcular e aplicar ganhos de atributos (com debuff)
    const attributeGains: Partial<Record<AttributeType, number>> = {};
    const baseGain = DIFFICULTY_ATTRIBUTE_GAIN[quest.difficulty];

    if (quest.relatedActivity) {
      // Buscar config da atividade relacionada para pegar os atributos
      const allConfigs = await categoryRepository.getAllActivityConfigs();
      const activityConfig = allConfigs[quest.relatedActivity];

      if (activityConfig && activityConfig.attributeImpacts) {
        // Distribuir ganhos entre os atributos da atividade
        for (const impact of activityConfig.attributeImpacts) {
          // Ganho base * peso do atributo na atividade * debuff
          const gain = baseGain * impact.weight * debuffMultipliers.attributes;
          attributeGains[impact.attribute] = Math.round(gain * 100) / 100;
        }
      }
    }

    // Aplicar ganhos de atributos se houver
    if (Object.keys(attributeGains).length > 0) {
      await characterRepository.updateMultipleAttributes(attributeGains);
    }

    // Atualizar quest com status e attributeGains
    const completedQuest: Quest = {
      ...quest,
      status: 'completed',
      completedAt: now,
      completionNotes: notes,
      attributeGains: Object.keys(attributeGains).length > 0 ? attributeGains : undefined,
      xpEarned: xpAfterDebuff,
      goldEarned: goldAfterDebuff,
      updatedAt: now,
    };

    await db.quests.put(completedQuest);

    // Atualizar progresso de duração nas metas (tempo mínimo vem das quests)
    if (quest.relatedActivity && quest.estimatedDuration) {
      try {
        const categoryGoals = await goalRepository.getByCategory(quest.relatedActivity);
        for (const goal of categoryGoals.filter(g => g.isActive)) {
          await goalRepository.updateProgress(goal.id, quest.estimatedDuration, 0);
        }
      } catch {
        // Ignora erros de metas
      }
    }

    // Registrar evento de XP
    const streakLabel = streakBonus > 1 ? ` (streak ${streakBonus.toFixed(1)}x)` : '';
    await db.xpEvents.add({
      id: uuid(),
      source: 'quest',
      sourceId: quest.id,
      amount: xpAfterDebuff,
      description: `Quest completada${streakLabel}: ${quest.title}`,
      timestamp: now,
    });

    // Se for recorrente, criar próxima quest
    if (quest.recurrence !== 'once') {
      await this.createNextRecurrence(quest);
    }

    return {
      quest: completedQuest,
      xpEarned: xpAfterDebuff,
      goldEarned: goldAfterDebuff,
      attributeGains,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
      newTitle: xpResult.newTitle,
      streakBonus,
      streakCount: recentCompleted,
    };
  },

  async fail(id: string): Promise<{ xpLost: number; goldLost: number; multiplier: number }> {
    const quest = await this.getById(id);
    if (!quest) throw new Error('Quest not found');
    if (quest.status !== 'pending') throw new Error('Apenas quests pendentes podem ser marcadas como não realizadas');

    const now = new Date().toISOString();

    // Contar falhas recentes (últimos 7 dias) para escalar penalidade
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);
    const recentFailed = await db.quests
      .where('status').equals('failed')
      .filter(q => q.updatedAt >= sevenDaysAgoStr)
      .count();

    // Multiplicador escalável: 1x base + 0.1x por falha recente, max 1.5x
    const multiplier = Math.min(1.5, 1 + recentFailed * 0.1);
    const catMult = CATEGORY_MULTIPLIERS[quest.category] ?? 1.0;
    const xpPenalty = Math.floor(DIFFICULTY_XP_PENALTY_MAP[quest.difficulty] * catMult * multiplier);
    const goldPenalty = Math.floor(DIFFICULTY_GOLD_PENALTY_MAP[quest.difficulty] * catMult * multiplier);

    await characterRepository.addPenalty(xpPenalty);
    await characterRepository.removeGold(goldPenalty);

    // Registrar evento de XP negativo
    await db.xpEvents.add({
      id: uuid(),
      source: 'quest',
      sourceId: quest.id,
      amount: -xpPenalty,
      description: `Quest não realizada${multiplier > 1 ? ` (${multiplier.toFixed(1)}x)` : ''}: ${quest.title}`,
      timestamp: now,
    });

    await db.quests.update(id, { status: 'failed', updatedAt: now });

    if (quest.recurrence !== 'once') {
      await this.createNextRecurrence(quest);
    }

    return { xpLost: xpPenalty, goldLost: goldPenalty, multiplier };
  },

  async unfail(id: string): Promise<void> {
    const quest = await this.getById(id);
    if (!quest) throw new Error('Quest not found');
    if (quest.status !== 'failed') throw new Error('Quest is not failed');

    // Remover a próxima recorrência que foi criada ao falhar
    if (quest.recurrence !== 'once') {
      await this.deleteNextRecurrence(quest);
    }

    await db.quests.update(id, {
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
  },

  async uncomplete(id: string): Promise<{ xpLost: number; goldLost: number; attributesLost: Partial<Record<AttributeType, number>> }> {
    const quest = await this.getById(id);
    if (!quest) throw new Error('Quest not found');
    if (quest.status !== 'completed') throw new Error('Quest is not completed');

    const xpLost = quest.xpEarned ?? quest.xpReward;
    const goldLost = quest.goldEarned ?? quest.goldReward;
    const attributesLost: Partial<Record<AttributeType, number>> = {};

    // Remover XP e Gold
    await characterRepository.removeXP(xpLost);
    await characterRepository.removeGold(goldLost);

    // Remover ganhos de atributos
    if (quest.attributeGains) {
      const negativeGains: Partial<Record<AttributeType, number>> = {};
      for (const [attr, gain] of Object.entries(quest.attributeGains)) {
        if (gain) {
          attributesLost[attr as AttributeType] = gain;
          negativeGains[attr as AttributeType] = -gain;
        }
      }
      await characterRepository.updateMultipleAttributes(negativeGains);
    } else if (quest.relatedActivity) {
      // Recalcular se não tiver attributeGains salvo
      const baseGain = DIFFICULTY_ATTRIBUTE_GAIN[quest.difficulty];
      const allConfigs = await categoryRepository.getAllActivityConfigs();
      const activityConfig = allConfigs[quest.relatedActivity];

      if (activityConfig && activityConfig.attributeImpacts) {
        const negativeGains: Partial<Record<AttributeType, number>> = {};
        for (const impact of activityConfig.attributeImpacts) {
          const gain = baseGain * impact.weight;
          const roundedGain = Math.round(gain * 100) / 100;
          attributesLost[impact.attribute] = roundedGain;
          negativeGains[impact.attribute] = -roundedGain;
        }
        await characterRepository.updateMultipleAttributes(negativeGains);
      }
    }

    // Reverter progresso de duração na meta
    if (quest.relatedActivity && quest.estimatedDuration) {
      try {
        const categoryGoals = await goalRepository.getByCategory(quest.relatedActivity);
        for (const goal of categoryGoals.filter(g => g.isActive)) {
          await goalRepository.updateProgress(goal.id, -quest.estimatedDuration, 0);
        }
      } catch {
        // Ignora erros de metas
      }
    }

    // Remover o evento de conclusão em vez de criar entrada negativa no histórico
    await db.xpEvents.filter(e => e.sourceId === quest.id && e.amount > 0).delete();

    // Remover a próxima recorrência que foi criada ao completar
    if (quest.recurrence !== 'once') {
      await this.deleteNextRecurrence(quest);
    }

    // Atualizar quest para pending
    await db.quests.update(id, {
      status: 'pending',
      completedAt: undefined,
      completionNotes: undefined,
      attributeGains: undefined,
      xpEarned: undefined,
      goldEarned: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { xpLost, goldLost, attributesLost };
  },

  async delete(id: string): Promise<{ xpLost: number; goldLost: number; attributesLost: Partial<Record<AttributeType, number>> }> {
    const quest = await this.getById(id);
    if (!quest) throw new Error('Quest not found');

    let xpLost = 0;
    let goldLost = 0;
    const attributesLost: Partial<Record<AttributeType, number>> = {};

    // Se a quest estava completa, remover XP, Gold e atributos ganhos
    if (quest.status === 'completed') {
      xpLost = quest.xpReward;
      goldLost = quest.goldReward;

      await characterRepository.removeXP(xpLost);
      await characterRepository.removeGold(goldLost);

      // Recalcular e remover ganhos de atributos
      if (quest.relatedActivity) {
        const baseGain = DIFFICULTY_ATTRIBUTE_GAIN[quest.difficulty];
        const allConfigs = await categoryRepository.getAllActivityConfigs();
        const activityConfig = allConfigs[quest.relatedActivity];

        if (activityConfig && activityConfig.attributeImpacts) {
          const negativeGains: Partial<Record<AttributeType, number>> = {};
          for (const impact of activityConfig.attributeImpacts) {
            const gain = baseGain * impact.weight;
            const roundedGain = Math.round(gain * 100) / 100;
            attributesLost[impact.attribute] = roundedGain;
            negativeGains[impact.attribute] = -roundedGain;
          }
          await characterRepository.updateMultipleAttributes(negativeGains);
        }
      }

      // Reverter progresso de duração na meta
      if (quest.relatedActivity && quest.estimatedDuration) {
        try {
          const categoryGoals = await goalRepository.getByCategory(quest.relatedActivity);
          for (const goal of categoryGoals.filter(g => g.isActive)) {
            await goalRepository.updateProgress(goal.id, -quest.estimatedDuration, 0);
          }
        } catch {
          // Ignora erros de metas
        }
      }

      // Registrar evento de XP negativo
      await db.xpEvents.add({
        id: uuid(),
        source: 'quest',
        sourceId: quest.id,
        amount: -xpLost,
        description: `Quest removida: ${quest.title}`,
        timestamp: new Date().toISOString(),
      });
    }

    await db.quests.delete(id);
    return { xpLost, goldLost, attributesLost };
  },

  async createNextRecurrence(quest: Quest): Promise<Quest | null> {
    if (quest.recurrence === 'once') return null;

    // Usar T00:00:00 para interpretar como horário local (não UTC)
    const currentDate = new Date(quest.scheduledDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate: Date;

    switch (quest.recurrence) {
      case 'daily':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        // Se a próxima data ainda é passado, pular para hoje
        if (nextDate < today) {
          nextDate = new Date(today);
        }
        break;
      case 'weekdays':
        nextDate = new Date(currentDate);
        do {
          nextDate.setDate(nextDate.getDate() + 1);
        } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
        // Se a próxima data ainda é passado, pular para hoje (ou próximo dia útil)
        if (nextDate < today) {
          nextDate = new Date(today);
          while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
            nextDate.setDate(nextDate.getDate() + 1);
          }
        }
        break;
      case 'weekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 7);
        // Se a próxima data ainda é passado, pular para hoje
        if (nextDate < today) {
          nextDate = new Date(today);
        }
        break;
      default:
        return null;
    }

    return this.create({
      title: quest.title,
      description: quest.description,
      category: quest.category,
      difficulty: quest.difficulty,
      recurrence: quest.recurrence,
      scheduledDate: getLocalDateString(nextDate),
      relatedActivity: quest.relatedActivity,
      estimatedDuration: quest.estimatedDuration,
    });
  },

  async deleteNextRecurrence(quest: Quest): Promise<void> {
    // Encontrar a próxima quest pendente com mesmo título e recorrência
    const candidates = await db.quests
      .where('scheduledDate')
      .above(quest.scheduledDate)
      .filter(q =>
        q.status === 'pending' &&
        q.title === quest.title &&
        q.recurrence === quest.recurrence
      )
      .sortBy('scheduledDate');

    if (candidates.length > 0) {
      await db.quests.delete(candidates[0].id);
    }
  },

  async failOverdueQuests(): Promise<number> {
    const today = getLocalDateString();
    const overdue = await db.quests
      .where('status')
      .equals('pending')
      .filter(q => q.scheduledDate < today)
      .toArray();

    let count = 0;
    for (const quest of overdue) {
      try {
        await this.fail(quest.id);
        count++;
      } catch {
        // ignora se já não for pending
      }
    }
    return count;
  },

  async getDailyStats(date: string) {
    const quests = await this.getByDate(date);

    return {
      total: quests.length,
      completed: quests.filter(q => q.status === 'completed').length,
      pending: quests.filter(q => q.status === 'pending').length,
      failed: quests.filter(q => q.status === 'failed').length,
      completionRate: quests.length > 0
        ? Math.round((quests.filter(q => q.status === 'completed').length / quests.length) * 100)
        : 0,
    };
  },
};
