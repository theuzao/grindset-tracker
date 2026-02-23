import type { ActivityCategory, ActivityConfig, AttributeType } from '@/types';

// ============================================
// Activity Configurations
// ============================================

export const ACTIVITY_CONFIGS: Record<ActivityCategory, ActivityConfig> = {
  study: {
    category: 'study',
    name: 'Estudo',
    icon: 'BookOpen',
    color: '#6366F1',
    // Legacy (para ActivityLogs antigos)
    baseXP: 15,
    xpPerMinute: 1.5,
    goldPerSession: 5,
    // Check-in rewards (fixos)
    checkInXP: 30,
    checkInGold: 10,
    checkInAttributeGain: 1.5,
    attributeImpacts: [
      { attribute: 'knowledge', weight: 0.4, gainPerMinute: 0.08 },
      { attribute: 'focus', weight: 0.3, gainPerMinute: 0.05 },
      { attribute: 'wisdom', weight: 0.2, gainPerMinute: 0.03 },
      { attribute: 'discipline', weight: 0.1, gainPerMinute: 0.02 },
    ],
  },
  workout: {
    category: 'workout',
    name: 'Academia',
    icon: 'Dumbbell',
    color: '#EF4444',
    // Legacy
    baseXP: 20,
    xpPerMinute: 2.0,
    goldPerSession: 8,
    // Check-in rewards
    checkInXP: 35,
    checkInGold: 15,
    checkInAttributeGain: 2.0,
    attributeImpacts: [
      { attribute: 'strength', weight: 0.4, gainPerMinute: 0.10 },
      { attribute: 'energy', weight: 0.3, gainPerMinute: 0.08 },
      { attribute: 'discipline', weight: 0.2, gainPerMinute: 0.04 },
      { attribute: 'resilience', weight: 0.1, gainPerMinute: 0.03 },
    ],
  },
  work: {
    category: 'work',
    name: 'Trabalho',
    icon: 'Briefcase',
    color: '#14B8A6',
    // Legacy
    baseXP: 12,
    xpPerMinute: 1.2,
    goldPerSession: 10,
    // Check-in rewards
    checkInXP: 25,
    checkInGold: 12,
    checkInAttributeGain: 1.0,
    attributeImpacts: [
      { attribute: 'discipline', weight: 0.35, gainPerMinute: 0.06 },
      { attribute: 'focus', weight: 0.35, gainPerMinute: 0.06 },
      { attribute: 'knowledge', weight: 0.15, gainPerMinute: 0.02 },
      { attribute: 'resilience', weight: 0.15, gainPerMinute: 0.02 },
    ],
  },
  meditation: {
    category: 'meditation',
    name: 'Meditação',
    icon: 'Brain',
    color: '#8B5CF6',
    // Legacy
    baseXP: 25,
    xpPerMinute: 2.5,
    goldPerSession: 5,
    // Check-in rewards
    checkInXP: 20,
    checkInGold: 8,
    checkInAttributeGain: 1.5,
    attributeImpacts: [
      { attribute: 'focus', weight: 0.35, gainPerMinute: 0.12 },
      { attribute: 'wisdom', weight: 0.25, gainPerMinute: 0.08 },
      { attribute: 'energy', weight: 0.20, gainPerMinute: 0.05 },
      { attribute: 'resilience', weight: 0.20, gainPerMinute: 0.05 },
    ],
  },
  reading: {
    category: 'reading',
    name: 'Leitura',
    icon: 'Book',
    color: '#F59E0B',
    // Legacy
    baseXP: 10,
    xpPerMinute: 1.0,
    goldPerSession: 3,
    // Check-in rewards
    checkInXP: 25,
    checkInGold: 10,
    checkInAttributeGain: 1.2,
    attributeImpacts: [
      { attribute: 'knowledge', weight: 0.35, gainPerMinute: 0.10 },
      { attribute: 'wisdom', weight: 0.30, gainPerMinute: 0.08 },
      { attribute: 'focus', weight: 0.20, gainPerMinute: 0.04 },
      { attribute: 'discipline', weight: 0.15, gainPerMinute: 0.03 },
    ],
  },
};

// ============================================
// Level System
// ============================================

const BASE_XP = 100;
const EXPONENT = 1.6;
export const MAX_LEVEL = 100;

export function calculateXPForLevel(level: number): number {
  if (level < 1) return 0;
  return Math.floor(BASE_XP * Math.pow(level, EXPONENT));
}

export function calculateTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += calculateXPForLevel(i);
  }
  return total;
}

export function getLevelFromTotalXP(totalXP: number): number {
  let level = 1;
  let accumulatedXP = 0;

  while (level < MAX_LEVEL) {
    const xpForNextLevel = calculateXPForLevel(level);
    if (accumulatedXP + xpForNextLevel > totalXP) {
      break;
    }
    accumulatedXP += xpForNextLevel;
    level++;
  }

  return level;
}

export function getXPProgressInLevel(totalXP: number): {
  currentLevelXP: number;
  requiredXP: number;
  percentage: number;
} {
  const level = getLevelFromTotalXP(totalXP);
  const xpAtLevelStart = calculateTotalXPForLevel(level);
  const xpForNextLevel = calculateXPForLevel(level);
  const currentLevelXP = totalXP - xpAtLevelStart;

  return {
    currentLevelXP,
    requiredXP: xpForNextLevel,
    percentage: xpForNextLevel > 0
      ? Math.floor((currentLevelXP / xpForNextLevel) * 100)
      : 100,
  };
}

// ============================================
// Level Titles
// ============================================

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Iniciante',
  5: 'Aprendiz',
  10: 'Praticante',
  15: 'Dedicado',
  20: 'Comprometido',
  25: 'Disciplinado',
  30: 'Experiente',
  35: 'Veterano',
  40: 'Expert',
  45: 'Mestre',
  50: 'Grande Mestre',
  60: 'Lenda',
  70: 'Mítico',
  80: 'Transcendente',
  90: 'Iluminado',
  100: 'Ascendido',
};

export function getTitleForLevel(level: number): string {
  const levels = Object.keys(LEVEL_TITLES)
    .map(Number)
    .sort((a, b) => b - a);

  for (const lvl of levels) {
    if (level >= lvl) {
      return LEVEL_TITLES[lvl];
    }
  }
  return LEVEL_TITLES[1];
}

// ============================================
// Streak Multipliers
// ============================================

export const STREAK_MULTIPLIERS: Record<number, number> = {
  3: 1.1,   // 3 dias: +10%
  7: 1.25,  // 7 dias: +25%
  14: 1.5,  // 14 dias: +50%
  30: 2.0,  // 30 dias: +100%
  60: 2.5,  // 60 dias: +150%
  90: 3.0,  // 90 dias: +200%
};

export function getStreakMultiplier(streak: number): number {
  const thresholds = Object.keys(STREAK_MULTIPLIERS)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (streak >= threshold) {
      return STREAK_MULTIPLIERS[threshold];
    }
  }
  return 1;
}

// ============================================
// Difficulty Multipliers
// ============================================

export const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.25,
  hard: 1.5,
};

// ============================================
// Quest Category Multipliers
// ============================================

export const CATEGORY_MULTIPLIERS: Record<string, number> = {
  main: 1.5,
  daily: 1.0,
  side: 0.7,
};

// ============================================
// XP Rewards
// ============================================

export const XP_REWARDS = {
  COMPLETE_QUEST_EASY: 10,
  COMPLETE_QUEST_MEDIUM: 20,
  COMPLETE_QUEST_HARD: 35,
  WRITE_REFLECTION: 15,          // daily, gratitude (base)
  WRITE_REFLECTION_WEEKLY: 30,   // weekly
  WRITE_REFLECTION_DEEP: 40,     // learning, insight
  COMPLETE_OBJECTIVE_SHORT: 100,
  COMPLETE_OBJECTIVE_MEDIUM: 300,
  COMPLETE_OBJECTIVE_LONG: 1000,
  COMPLETE_MILESTONE: 25,
  DAILY_LOGIN: 5,
  PERFECT_DAY: 50,
};

export const GOLD_REWARDS = {
  COMPLETE_QUEST_EASY: 5,
  COMPLETE_QUEST_MEDIUM: 10,
  COMPLETE_QUEST_HARD: 20,
  WRITE_REFLECTION: 5,
  COMPLETE_OBJECTIVE_SHORT: 50,
  COMPLETE_OBJECTIVE_MEDIUM: 150,
  COMPLETE_OBJECTIVE_LONG: 500,
};

// Penalidades por marcar quest como "não realizada"
export const XP_PENALTIES = {
  FAIL_QUEST_EASY: 5,
  FAIL_QUEST_MEDIUM: 10,
  FAIL_QUEST_HARD: 18,
};

export const GOLD_PENALTIES = {
  FAIL_QUEST_EASY: 3,
  FAIL_QUEST_MEDIUM: 5,
  FAIL_QUEST_HARD: 10,
};

// ============================================
// Initial Attributes
// ============================================

export const INITIAL_ATTRIBUTES: Record<AttributeType, { name: string; icon: string; color: string }> = {
  focus: { name: 'Foco', icon: 'Target', color: '#6366F1' },
  discipline: { name: 'Disciplina', icon: 'CalendarCheck', color: '#EF4444' },
  energy: { name: 'Energia', icon: 'Zap', color: '#14B8A6' },
  knowledge: { name: 'Conhecimento', icon: 'BookOpen', color: '#F59E0B' },
  strength: { name: 'Força', icon: 'Dumbbell', color: '#EC4899' },
  wisdom: { name: 'Sabedoria', icon: 'Brain', color: '#8B5CF6' },
  resilience: { name: 'Resiliência', icon: 'Shield', color: '#06B6D4' },
};
