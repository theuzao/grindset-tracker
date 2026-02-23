import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { CheckIn, CheckInStreak, ActivityCategory, AttributeType } from '@/types';
import { categoryRepository } from './categoryRepository';
import { characterRepository } from './characterRepository';
import { goalRepository } from './goalRepository';
import { debuffRepository } from './debuffRepository';
import { getStreakMultiplier } from '@/features/gamification/constants';

export interface CheckInResult {
  checkIn: CheckIn;
  xpEarned: number;
  goldEarned: number;
  attributeGains: Partial<Record<AttributeType, number>>;
  streakUpdated: boolean;
  newStreak: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
}

export interface CategoryStats {
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  monthlyCheckIns: number;
  monthlyRate: number;
}

export const checkInRepository = {
  // Verifica se já fez check-in hoje para uma categoria
  async hasCheckedInToday(category: ActivityCategory): Promise<boolean> {
    const today = getLocalDateString();
    const existing = await db.checkIns
      .where('[category+date]')
      .equals([category, today])
      .first();
    return !!existing;
  },

  // Busca check-in de hoje para uma categoria
  async getTodayCheckIn(category: ActivityCategory): Promise<CheckIn | undefined> {
    const today = getLocalDateString();
    return db.checkIns
      .where('[category+date]')
      .equals([category, today])
      .first();
  },

  // Busca check-in por categoria e data específica
  async getCheckInByDate(category: ActivityCategory, date: string): Promise<CheckIn | undefined> {
    return db.checkIns
      .where('[category+date]')
      .equals([category, date])
      .first();
  },

  // Busca todos os check-ins de hoje
  async getTodayCheckIns(): Promise<CheckIn[]> {
    const today = getLocalDateString();
    return db.checkIns.where('date').equals(today).toArray();
  },

  // Realiza check-in para uma categoria
  async checkIn(category: ActivityCategory): Promise<CheckInResult> {
    // Verificar se já fez check-in hoje
    const alreadyCheckedIn = await this.hasCheckedInToday(category);
    if (alreadyCheckedIn) {
      throw new Error('Você já fez check-in hoje para esta categoria');
    }

    // Buscar config da categoria
    const allConfigs = await categoryRepository.getAllActivityConfigs();
    const config = allConfigs[category];
    if (!config) {
      throw new Error(`Categoria "${category}" não encontrada`);
    }

    // Buscar character para streak multiplier
    const character = await characterRepository.get();
    if (!character) {
      throw new Error('Personagem não encontrado');
    }

    const now = new Date().toISOString();
    const today = getLocalDateString();

    // Calcular recompensas com multiplicador de streak e debuffs
    const streakMultiplier = getStreakMultiplier(character.streak.current);
    const debuffMultipliers = await debuffRepository.getAllMultipliers();
    const xpEarned = Math.floor(config.checkInXP * streakMultiplier * debuffMultipliers.xp);
    const goldEarned = Math.floor(config.checkInGold * debuffMultipliers.gold);

    // Calcular ganhos de atributos (com debuff)
    const attributeGains: Partial<Record<AttributeType, number>> = {};
    for (const impact of config.attributeImpacts) {
      attributeGains[impact.attribute] = Math.round(config.checkInAttributeGain * impact.weight * debuffMultipliers.attributes * 100) / 100;
    }

    // Criar registro de check-in
    const checkIn: CheckIn = {
      id: uuid(),
      category,
      date: today,
      xpEarned,
      goldEarned,
      attributeGains,
      createdAt: now,
      updatedAt: now,
    };

    // Salvar check-in
    await db.checkIns.add(checkIn);

    // Atualizar streak da categoria
    const newStreak = await this.updateCategoryStreak(category);

    // Atualizar character (XP, Gold, Atributos, Streak global)
    const levelResult = await characterRepository.addXP(xpEarned, { source: 'check-in', label: config.name });
    await characterRepository.addGold(goldEarned);
    await characterRepository.updateMultipleAttributes(attributeGains);
    await characterRepository.updateStreak();

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'check-in',
      sourceId: checkIn.id,
      amount: xpEarned,
      description: `Check-in: ${config.name}`,
      timestamp: now,
    });

    // Atualizar progresso de dias/sessões nas metas (dias mínimos vêm dos check-ins)
    try {
      const categoryGoals = await goalRepository.getByCategory(category);
      for (const goal of categoryGoals.filter(g => g.isActive)) {
        await goalRepository.updateProgress(goal.id, 0, 1);
      }
    } catch {
      // Ignora erros de metas
    }

    return {
      checkIn,
      xpEarned,
      goldEarned,
      attributeGains,
      streakUpdated: true,
      newStreak,
      leveledUp: levelResult.leveledUp,
      newLevel: levelResult.newLevel,
      newTitle: levelResult.newTitle,
    };
  },

  // Realiza check-in para uma data específica (para correções de dias passados)
  async checkInForDate(category: ActivityCategory, date: string): Promise<CheckInResult> {
    // Verificar se já existe check-in para essa data
    const existing = await this.getCheckInByDate(category, date);
    if (existing) {
      throw new Error('Já existe check-in para esta data');
    }

    // Bloquear datas futuras
    const today = getLocalDateString();
    if (date > today) {
      throw new Error('Não é possível fazer check-in para datas futuras');
    }

    // Buscar config da categoria
    const allConfigs = await categoryRepository.getAllActivityConfigs();
    const config = allConfigs[category];
    if (!config) {
      throw new Error(`Categoria "${category}" não encontrada`);
    }

    // Buscar character para streak multiplier
    const character = await characterRepository.get();
    if (!character) {
      throw new Error('Personagem não encontrado');
    }

    const now = new Date().toISOString();

    // Calcular recompensas com multiplicador de streak e debuffs
    const streakMultiplier = getStreakMultiplier(character.streak.current);
    const debuffMultipliers = await debuffRepository.getAllMultipliers();
    const xpEarned = Math.floor(config.checkInXP * streakMultiplier * debuffMultipliers.xp);
    const goldEarned = Math.floor(config.checkInGold * debuffMultipliers.gold);

    // Calcular ganhos de atributos (com debuff)
    const attributeGains: Partial<Record<AttributeType, number>> = {};
    for (const impact of config.attributeImpacts) {
      attributeGains[impact.attribute] = Math.round(config.checkInAttributeGain * impact.weight * debuffMultipliers.attributes * 100) / 100;
    }

    // Criar registro de check-in
    const checkIn: CheckIn = {
      id: uuid(),
      category,
      date,
      xpEarned,
      goldEarned,
      attributeGains,
      createdAt: now,
      updatedAt: now,
    };

    // Salvar check-in
    await db.checkIns.add(checkIn);

    // Recalcular streak da categoria (porque estamos adicionando em data passada)
    await this.recalculateCategoryStreak(category);
    const streak = await this.getStreak(category);

    // Atualizar character (XP, Gold, Atributos)
    const levelResult = await characterRepository.addXP(xpEarned);
    await characterRepository.addGold(goldEarned);
    await characterRepository.updateMultipleAttributes(attributeGains);

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'check-in',
      sourceId: checkIn.id,
      amount: xpEarned,
      description: `Check-in: ${config.name}`,
      timestamp: now,
    });

    return {
      checkIn,
      xpEarned,
      goldEarned,
      attributeGains,
      streakUpdated: true,
      newStreak: streak?.currentStreak ?? 1,
      leveledUp: levelResult.leveledUp,
      newLevel: levelResult.newLevel,
      newTitle: levelResult.newTitle,
    };
  },

  // Desfazer check-in (para correções)
  async undoCheckIn(id: string): Promise<void> {
    const checkIn = await db.checkIns.get(id);
    if (!checkIn) {
      throw new Error('Check-in não encontrado');
    }

    // Reverter XP, Gold e Atributos
    await characterRepository.removeXP(checkIn.xpEarned);
    await characterRepository.removeGold(checkIn.goldEarned);

    // Reverter atributos (subtrair ganhos)
    const negativeGains: Partial<Record<AttributeType, number>> = {};
    for (const [attr, gain] of Object.entries(checkIn.attributeGains)) {
      if (gain) {
        negativeGains[attr as AttributeType] = -gain;
      }
    }
    await characterRepository.updateMultipleAttributes(negativeGains);

    // Registrar evento de XP negativo
    await db.xpEvents.add({
      id: uuid(),
      source: 'check-in',
      sourceId: id,
      amount: -checkIn.xpEarned,
      description: `Check-in desfeito: ${checkIn.category}`,
      timestamp: new Date().toISOString(),
    });

    // Remover check-in
    await db.checkIns.delete(id);

    // Recalcular streak da categoria
    await this.recalculateCategoryStreak(checkIn.category);
  },

  // Desfazer check-in por categoria e data
  async undoCheckInByDate(category: ActivityCategory, date: string): Promise<void> {
    const checkIn = await this.getCheckInByDate(category, date);
    if (!checkIn) {
      throw new Error('Check-in não encontrado para esta data');
    }
    await this.undoCheckIn(checkIn.id);
  },

  // Atualiza streak de uma categoria após check-in
  async updateCategoryStreak(category: ActivityCategory): Promise<number> {
    const today = getLocalDateString();

    let streak = await db.checkInStreaks.get(category);

    if (!streak) {
      // Primeiro check-in desta categoria
      streak = {
        category,
        currentStreak: 1,
        longestStreak: 1,
        lastCheckInDate: today,
        totalCheckIns: 1,
      };
      await db.checkInStreaks.put(streak);
      return 1;
    }

    // Verificar se já atualizou hoje
    if (streak.lastCheckInDate === today) {
      return streak.currentStreak;
    }

    // Verificar se o último check-in foi ontem
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let newStreak: number;
    if (streak.lastCheckInDate === yesterdayStr) {
      // Continua streak
      newStreak = streak.currentStreak + 1;
    } else {
      // Streak quebrado, reinicia
      newStreak = 1;
    }

    const updatedStreak: CheckInStreak = {
      ...streak,
      currentStreak: newStreak,
      longestStreak: Math.max(streak.longestStreak, newStreak),
      lastCheckInDate: today,
      totalCheckIns: streak.totalCheckIns + 1,
    };

    await db.checkInStreaks.put(updatedStreak);
    return newStreak;
  },

  // Recalcula streak de uma categoria (após undo ou correção)
  async recalculateCategoryStreak(category: ActivityCategory): Promise<void> {
    const checkIns = await db.checkIns
      .where('category')
      .equals(category)
      .sortBy('date');

    if (checkIns.length === 0) {
      await db.checkInStreaks.delete(category);
      return;
    }

    // Calcular streak atual e maior streak
    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < checkIns.length; i++) {
      const prevDate = new Date(checkIns[i - 1].date);
      const currDate = new Date(checkIns[i].date);

      // Diferença em dias
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
      // Se diffDays === 0, é o mesmo dia, ignora
    }

    // Verificar se o último check-in foi hoje ou ontem para streak atual
    const lastCheckIn = checkIns[checkIns.length - 1];
    const today = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    if (lastCheckIn.date === today || lastCheckIn.date === yesterdayStr) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }

    const streak: CheckInStreak = {
      category,
      currentStreak,
      longestStreak,
      lastCheckInDate: lastCheckIn.date,
      totalCheckIns: checkIns.length,
    };

    await db.checkInStreaks.put(streak);
  },

  // Busca streak de uma categoria
  async getStreak(category: ActivityCategory): Promise<CheckInStreak | undefined> {
    return db.checkInStreaks.get(category);
  },

  // Busca todas as streaks
  async getAllStreaks(): Promise<CheckInStreak[]> {
    return db.checkInStreaks.toArray();
  },

  // Busca check-ins de um mês específico para uma categoria
  async getMonthlyCheckIns(
    category: ActivityCategory,
    year: number,
    month: number
  ): Promise<number[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const checkIns = await db.checkIns
      .where('[category+date]')
      .between([category, startDate], [category, endDate], true, true)
      .toArray();

    return checkIns.map(c => parseInt(c.date.split('-')[2]));
  },

  // Busca estatísticas de uma categoria
  async getCategoryStats(category: ActivityCategory): Promise<CategoryStats> {
    const streak = await this.getStreak(category);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthlyDays = await this.getMonthlyCheckIns(category, year, month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysPassed = Math.min(now.getDate(), daysInMonth);

    return {
      totalCheckIns: streak?.totalCheckIns ?? 0,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      monthlyCheckIns: monthlyDays.length,
      monthlyRate: daysPassed > 0 ? Math.round((monthlyDays.length / daysPassed) * 100) : 0,
    };
  },

  // Busca histórico de check-ins de uma categoria
  async getCheckInHistory(
    category: ActivityCategory,
    limit?: number
  ): Promise<CheckIn[]> {
    let query = db.checkIns.where('category').equals(category);

    const checkIns = await query.reverse().sortBy('date');

    return limit ? checkIns.slice(0, limit) : checkIns;
  },

  // Busca todos os check-ins em um range de datas
  async getCheckInsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<CheckIn[]> {
    return db.checkIns
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  },
};
