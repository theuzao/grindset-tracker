import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { Character, AttributeType, Attribute } from '@/types';
import {
  INITIAL_ATTRIBUTES,
  ACTIVITY_CONFIGS,
  getLevelFromTotalXP,
  getTitleForLevel,
} from '@/features/gamification/constants';
import { addLevelUpNotification } from '@/utils/notifications';
import { dispatchXPFeedback } from '@/utils/xpFeedback';

function createInitialAttributes(): Record<AttributeType, Attribute> {
  const attributes: AttributeType[] = [
    'focus', 'discipline', 'energy', 'knowledge', 'strength', 'wisdom', 'resilience'
  ];
  const result = {} as Record<AttributeType, Attribute>;
  for (const attr of attributes) {
    result[attr] = {
      type: attr,
      name: INITIAL_ATTRIBUTES[attr].name,
      icon: INITIAL_ATTRIBUTES[attr].icon,
      color: INITIAL_ATTRIBUTES[attr].color,
      currentValue: 0,
      baseValue: 0,
    };
  }
  return result;
}

export const characterRepository = {
  async get(): Promise<Character | undefined> {
    return db.character.toCollection().first();
  },

  async create(name: string): Promise<Character> {
    const now = new Date().toISOString();
    const character: Character = {
      id: uuid(),
      name,
      title: 'Iniciante',
      level: 1,
      currentXP: 0,
      totalXP: 0,
      gold: 0,
      pendingPenalty: 0,
      attributes: createInitialAttributes(),
      streak: { current: 0, longest: 0, lastActiveDate: now },
      createdAt: now,
      updatedAt: now,
    };
    await db.character.add(character);
    return character;
  },

  async update(id: string, updates: Partial<Character>): Promise<void> {
    await db.character.update(id, { ...updates, updatedAt: new Date().toISOString() });
  },

  async addXP(
    amount: number,
    feedbackMeta?: { source: string; label: string }
  ): Promise<{ leveledUp: boolean; newLevel?: number; newTitle?: string; penaltyAbsorbed: number; netXPGained: number }> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');

    const previousLevel = character.level;
    const newTotalXP = character.totalXP + amount;
    const newLevel = getLevelFromTotalXP(newTotalXP);
    const newTitle = getTitleForLevel(newLevel);

    await db.character.update(character.id, {
      totalXP: newTotalXP,
      currentXP: newTotalXP,
      level: newLevel,
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });

    if (newLevel > previousLevel) {
      addLevelUpNotification(newLevel, newTitle);
    }

    if (feedbackMeta) {
      dispatchXPFeedback({
        xp: amount,
        source: feedbackMeta.source,
        label: feedbackMeta.label,
      });
    }

    return {
      leveledUp: newLevel > previousLevel,
      newLevel: newLevel > previousLevel ? newLevel : undefined,
      newTitle: newLevel > previousLevel ? newTitle : undefined,
      penaltyAbsorbed: 0,
      netXPGained: amount,
    };
  },

  // Penalidade: drena XP até o piso de 0 (sem dívida acumulada)
  async addPenalty(amount: number): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');

    const newTotalXP = Math.max(0, character.totalXP - amount);
    const newLevel = getLevelFromTotalXP(newTotalXP);
    const newTitle = getTitleForLevel(newLevel);

    await db.character.update(character.id, {
      totalXP: newTotalXP,
      currentXP: newTotalXP,
      level: newLevel,
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });
  },

  async addGold(amount: number): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    await db.character.update(character.id, {
      gold: character.gold + amount,
      updatedAt: new Date().toISOString(),
    });
  },

  async removeXP(amount: number): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    const newTotalXP = Math.max(0, character.totalXP - amount);
    const newLevel = getLevelFromTotalXP(newTotalXP);
    const newTitle = getTitleForLevel(newLevel);
    await db.character.update(character.id, {
      totalXP: newTotalXP,
      currentXP: newTotalXP,
      level: newLevel,
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });
  },

  async removeGold(amount: number): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    await db.character.update(character.id, {
      gold: Math.max(0, character.gold - amount),
      updatedAt: new Date().toISOString(),
    });
  },

  async updateAttribute(attribute: AttributeType, gain: number): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    const currentValue = character.attributes[attribute].currentValue;
    const newValue = Math.min(100, Math.max(0, currentValue + gain));
    const updatedAttributes = {
      ...character.attributes,
      [attribute]: { ...character.attributes[attribute], currentValue: newValue },
    };
    await db.character.update(character.id, {
      attributes: updatedAttributes,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateMultipleAttributes(gains: Partial<Record<AttributeType, number>>): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    const updatedAttributes = { ...character.attributes };
    for (const [attr, gain] of Object.entries(gains)) {
      const attribute = attr as AttributeType;
      if (gain && updatedAttributes[attribute]) {
        const currentValue = updatedAttributes[attribute].currentValue;
        updatedAttributes[attribute] = {
          ...updatedAttributes[attribute],
          currentValue: Math.min(100, Math.max(0, currentValue + gain)),
        };
      }
    }
    await db.character.update(character.id, {
      attributes: updatedAttributes,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateStreak(): Promise<{ newStreak: number; streakBroken: boolean }> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');

    const today = getLocalDateString();
    const lastActive = character.streak.lastActiveDate.split('T')[0];

    if (lastActive === today) {
      return { newStreak: character.streak.current, streakBroken: false };
    }

    const defaultKeys = Object.keys(ACTIVITY_CONFIGS);
    const customCategories = await db.customCategories.filter(c => c.isActive === true).toArray();
    const allCategoryKeys = [...defaultKeys, ...customCategories.map(c => c.key)];

    const todayCheckIns = await db.checkIns.where('date').equals(today).toArray();
    const checkedCategories = new Set(todayCheckIns.map(c => c.category));
    const allCheckedIn = allCategoryKeys.every(key => checkedCategories.has(key));

    if (!allCheckedIn) {
      return { newStreak: character.streak.current, streakBroken: false };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let newStreak: number;
    let streakBroken = false;

    if (lastActive === yesterdayStr) {
      newStreak = character.streak.current + 1;
    } else {
      newStreak = 1;
      streakBroken = character.streak.current > 0;
    }

    await db.character.update(character.id, {
      streak: {
        current: newStreak,
        longest: Math.max(character.streak.longest, newStreak),
        lastActiveDate: today,
      },
      updatedAt: new Date().toISOString(),
    });

    return { newStreak, streakBroken };
  },

  async updateAvatar(avatar: string | null): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    await db.character.update(character.id, {
      avatar: avatar || undefined,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateBanner(banner: string | null): Promise<void> {
    const character = await this.get();
    if (!character) throw new Error('Character not found');
    await db.character.update(character.id, {
      banner: banner || undefined,
      updatedAt: new Date().toISOString(),
    });
  },
};
