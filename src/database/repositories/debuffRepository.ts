import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { Debuff, DebuffType } from '@/types';

interface ApplyDebuffInput {
  type: DebuffType;
  severity: 1 | 2 | 3;
  sourceGoalId?: string;
  durationHours: number;
}

const DEBUFF_CONFIG: Record<DebuffType, {
  name: string;
  description: string;
  multipliers: Record<1 | 2 | 3, number>;
}> = {
  xp_reduction: {
    name: 'Fadiga Mental',
    description: 'Você não cumpriu suas metas. XP ganho reduzido.',
    multipliers: { 1: 0.9, 2: 0.75, 3: 0.5 },
  },
  gold_reduction: {
    name: 'Bolsos Furados',
    description: 'Falta de disciplina afeta suas recompensas. Gold reduzido.',
    multipliers: { 1: 0.9, 2: 0.75, 3: 0.5 },
  },
  attribute_decay: {
    name: 'Atrofia',
    description: 'Falta de prática causa perda de atributos.',
    multipliers: { 1: 0.95, 2: 0.9, 3: 0.8 },
  },
  streak_risk: {
    name: 'Risco de Streak',
    description: 'Seu streak está em perigo se continuar não cumprindo metas.',
    multipliers: { 1: 1, 2: 1, 3: 1 },
  },
};

export const debuffRepository = {
  async getById(id: string): Promise<Debuff | undefined> {
    return db.debuffs.get(id);
  },

  async getAll(): Promise<Debuff[]> {
    return db.debuffs.toArray();
  },

  async getActive(): Promise<Debuff[]> {
    const now = new Date().toISOString();
    const allDebuffs = await db.debuffs.where('isActive').equals(1).toArray();

    // Filtrar debuffs expirados e desativá-los
    const active: Debuff[] = [];
    for (const debuff of allDebuffs) {
      if (debuff.expiresAt <= now) {
        await this.expire(debuff.id);
      } else {
        active.push(debuff);
      }
    }

    return active;
  },

  async applyDebuff(input: ApplyDebuffInput): Promise<Debuff> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.durationHours * 60 * 60 * 1000);
    const config = DEBUFF_CONFIG[input.type];

    const debuff: Debuff = {
      id: uuid(),
      type: input.type,
      name: config.name,
      description: config.description,
      severity: input.severity,
      multiplier: config.multipliers[input.severity],
      sourceGoalId: input.sourceGoalId,
      appliedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    };

    await db.debuffs.add(debuff);
    return debuff;
  },

  async expire(id: string): Promise<void> {
    await db.debuffs.update(id, { isActive: false });
  },

  async remove(id: string): Promise<void> {
    await db.debuffs.delete(id);
  },

  async clearExpired(): Promise<number> {
    const now = new Date().toISOString();
    const expired = await db.debuffs
      .filter(d => d.isActive && d.expiresAt <= now)
      .toArray();

    for (const debuff of expired) {
      await this.expire(debuff.id);
    }

    return expired.length;
  },

  // Calcular multiplicador total para um tipo de debuff (floor mínimo: 0.4x para XP)
  async getTotalMultiplier(type: DebuffType): Promise<number> {
    const activeDebuffs = await this.getActive();
    const relevantDebuffs = activeDebuffs.filter(d => d.type === type);

    if (relevantDebuffs.length === 0) return 1;

    // Multiplicar todos os debuffs do mesmo tipo
    const result = relevantDebuffs.reduce((acc, d) => acc * d.multiplier, 1);

    // Floor de 0.4x para não zerar completamente as recompensas
    if (type === 'xp_reduction') return Math.max(0.4, result);
    if (type === 'gold_reduction') return Math.max(0.4, result);
    return result;
  },

  // Obter todos os multiplicadores ativos
  async getAllMultipliers(): Promise<{
    xp: number;
    gold: number;
    attributes: number;
  }> {
    try {
      const [xp, gold, attributes] = await Promise.all([
        this.getTotalMultiplier('xp_reduction'),
        this.getTotalMultiplier('gold_reduction'),
        this.getTotalMultiplier('attribute_decay'),
      ]);

      return { xp, gold, attributes };
    } catch {
      // Se houver erro (ex: tabela não existe), retorna multiplicadores padrão
      return { xp: 1, gold: 1, attributes: 1 };
    }
  },

  // Verificar se há debuffs ativos de um tipo específico
  async hasActiveDebuff(type: DebuffType): Promise<boolean> {
    const active = await this.getActive();
    return active.some(d => d.type === type);
  },

  // Obter informações formatadas dos debuffs ativos
  async getActiveDebuffsInfo(): Promise<Array<{
    debuff: Debuff;
    remainingTime: string;
    reductionPercent: number;
  }>> {
    const active = await this.getActive();
    const now = new Date();

    return active.map(debuff => {
      const expiresAt = new Date(debuff.expiresAt);
      const remainingMs = expiresAt.getTime() - now.getTime();
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        debuff,
        remainingTime: remainingHours > 0
          ? `${remainingHours}h ${remainingMinutes}m`
          : `${remainingMinutes}m`,
        reductionPercent: Math.round((1 - debuff.multiplier) * 100),
      };
    });
  },
};
