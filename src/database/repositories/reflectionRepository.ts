import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { Reflection, ReflectionType, MoodLevel } from '@/types';
import { XP_REWARDS } from '@/features/gamification/constants';
import { characterRepository } from './characterRepository';

function getReflectionXP(type: ReflectionType): number {
  if (type === 'weekly') return XP_REWARDS.WRITE_REFLECTION_WEEKLY;
  if (type === 'learning' || type === 'insight') return XP_REWARDS.WRITE_REFLECTION_DEEP;
  return XP_REWARDS.WRITE_REFLECTION; // daily, gratitude
}

interface CreateReflectionInput {
  type: ReflectionType;
  title?: string;
  content: string;
  mood?: MoodLevel;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  isPinned?: boolean;
}

interface UpdateReflectionInput {
  title?: string;
  content?: string;
  type?: ReflectionType;
  mood?: MoodLevel;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  isPinned?: boolean;
}

export const reflectionRepository = {
  async getById(id: string): Promise<Reflection | undefined> {
    return db.reflections.get(id);
  },

  async getAll(limit = 50): Promise<Reflection[]> {
    return db.reflections.orderBy('date').reverse().limit(limit).toArray();
  },

  async getByType(type: ReflectionType, limit = 20): Promise<Reflection[]> {
    return db.reflections
      .where('type')
      .equals(type)
      .reverse()
      .sortBy('date')
      .then(r => r.slice(0, limit));
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Reflection[]> {
    return db.reflections
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  },

  async getByTag(tag: string): Promise<Reflection[]> {
    return db.reflections
      .where('tags')
      .equals(tag)
      .toArray();
  },

  async getPinned(): Promise<Reflection[]> {
    const all = await db.reflections.toArray();
    return all.filter(r => r.isPinned === true).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  async getRecent(limit = 5): Promise<Reflection[]> {
    return db.reflections.orderBy('date').reverse().limit(limit).toArray();
  },

  async create(input: CreateReflectionInput): Promise<Reflection> {
    const now = new Date().toISOString();
    const xpAmount = getReflectionXP(input.type);

    const reflection: Reflection = {
      id: uuid(),
      type: input.type,
      title: input.title,
      content: input.content,
      date: now,
      mood: input.mood,
      energyLevel: input.energyLevel,
      tags: input.tags || [],
      xpEarned: xpAmount,
      isPinned: input.isPinned || false,
      createdAt: now,
      updatedAt: now,
    };

    await db.reflections.add(reflection);

    // Dar XP por escrever reflexão (variável por tipo)
    await characterRepository.addXP(xpAmount);

    // Registrar evento de XP
    await db.xpEvents.add({
      id: uuid(),
      source: 'reflection',
      sourceId: reflection.id,
      amount: xpAmount,
      description: `Reflexao: ${input.title || input.type}`,
      timestamp: now,
    });

    return reflection;
  },

  async update(id: string, input: UpdateReflectionInput): Promise<Reflection> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Reflection not found');

    const updated: Reflection = {
      ...existing,
      ...input,
      tags: input.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };

    await db.reflections.put(updated);
    return updated;
  },

  async togglePin(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Reflection not found');

    const newPinned = !(existing.isPinned || false);
    const updated: Reflection = {
      ...existing,
      isPinned: newPinned,
      updatedAt: new Date().toISOString(),
    };
    await db.reflections.put(updated);

    return newPinned;
  },

  async delete(id: string): Promise<void> {
    await db.reflections.delete(id);
  },

  async getAllTags(): Promise<string[]> {
    const all = await db.reflections.toArray();
    const tags = new Set<string>();
    all.forEach(r => r.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  },

  async search(query: string): Promise<Reflection[]> {
    const all = await db.reflections.toArray();
    const lower = query.toLowerCase();
    return all.filter(r =>
      r.content.toLowerCase().includes(lower) ||
      r.title?.toLowerCase().includes(lower) ||
      r.tags.some(t => t.toLowerCase().includes(lower))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getStats() {
    const all = await db.reflections.toArray();

    const byType: Record<ReflectionType, number> = {
      daily: 0,
      weekly: 0,
      learning: 0,
      gratitude: 0,
      insight: 0,
    };

    all.forEach(r => {
      if (byType[r.type] !== undefined) {
        byType[r.type]++;
      }
    });

    return {
      total: all.length,
      byType,
      totalXP: all.reduce((sum, r) => sum + r.xpEarned, 0),
      pinned: all.filter(r => r.isPinned).length,
    };
  },
};
