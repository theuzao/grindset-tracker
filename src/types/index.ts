// ============================================
// Common Types
// ============================================

export type UUID = string;
export type ISODateString = string;

export interface BaseEntity {
  id: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ============================================
// Character & Attributes
// ============================================

export type AttributeType =
  | 'focus'       // Foco - concentração e atenção
  | 'discipline'  // Disciplina - consistência e autocontrole
  | 'energy'      // Energia - vitalidade e disposição
  | 'knowledge'   // Conhecimento - aprendizado acumulado
  | 'strength'    // Força - resistência física
  | 'wisdom'      // Sabedoria - reflexão e insights
  | 'resilience'; // Resiliência - persistência ante dificuldades

export interface Attribute {
  type: AttributeType;
  name: string;
  icon: string;
  color: string;
  currentValue: number;  // 0-100
  baseValue: number;
}

export interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: ISODateString;
}

export interface Character extends BaseEntity {
  name: string;
  title: string;
  level: number;
  currentXP: number;
  totalXP: number;
  gold: number;
  pendingPenalty?: number; // Dívida de XP por falhas de quest
  attributes: Record<AttributeType, Attribute>;
  streak: StreakData;
  avatar?: string;
  banner?: string;
}

// ============================================
// Activities
// ============================================

// Categorias padrão do sistema
export type DefaultActivityCategory =
  | 'study'      // Estudo
  | 'workout'    // Academia/Treino
  | 'work'       // Trabalho
  | 'meditation' // Meditação
  | 'reading';   // Leitura

// Categoria pode ser padrão ou customizada (string)
export type ActivityCategory = DefaultActivityCategory | string;

export interface ActivityConfig {
  category: ActivityCategory;
  name: string;
  icon: string;
  color: string;
  // Legacy fields (para ActivityLogs antigos)
  baseXP: number;
  xpPerMinute: number;
  goldPerSession: number;
  // Check-in rewards (fixos por check-in)
  checkInXP: number;
  checkInGold: number;
  checkInAttributeGain: number;
  attributeImpacts: {
    attribute: AttributeType;
    weight: number;
    gainPerMinute: number;
  }[];
}

// Impacto de atributo customizado
export interface CustomAttributeImpact {
  attribute: AttributeType;
  gainPerMinute: number;
}

// Categoria customizada criada pelo usuário
export interface CustomActivityCategory extends BaseEntity {
  key: string; // identificador único (slug)
  name: string;
  icon: string;
  color: string;
  baseXP: number;
  xpPerMinute: number;
  goldPerSession: number;
  // Legacy fields (para compatibilidade)
  primaryAttribute?: AttributeType;
  secondaryAttribute?: AttributeType;
  // Novo: lista completa de impactos de atributos
  attributeImpacts?: CustomAttributeImpact[];
  isActive: boolean;
}

export interface ActivityLog extends BaseEntity {
  category: ActivityCategory;
  duration: number; // minutos
  xpEarned: number;
  goldEarned: number;
  attributeGains: Partial<Record<AttributeType, number>>;
  notes?: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  difficulty?: 'easy' | 'medium' | 'hard';
  completedAt: ISODateString;
}

// ============================================
// Check-ins (Hábitos Diários)
// ============================================

export interface CheckIn extends BaseEntity {
  category: ActivityCategory;
  date: ISODateString; // YYYY-MM-DD
  xpEarned: number;
  goldEarned: number;
  attributeGains: Partial<Record<AttributeType, number>>;
}

export interface CheckInStreak {
  category: ActivityCategory;
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: ISODateString;
  totalCheckIns: number;
}

// ============================================
// Quests (Daily Tasks)
// ============================================

export type QuestCategory = 'daily' | 'main' | 'side';
export type QuestDifficulty = 'easy' | 'medium' | 'hard';
export type QuestStatus = 'pending' | 'completed' | 'failed';
export type QuestRecurrence = 'once' | 'daily' | 'weekdays' | 'weekly';

export interface Quest extends BaseEntity {
  title: string;
  description?: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  recurrence: QuestRecurrence;
  scheduledDate: ISODateString;
  estimatedDuration?: number | null; // minutos, null = N/A
  xpReward: number;
  goldReward: number;
  relatedActivity?: ActivityCategory;
  completedAt?: ISODateString;
  completionNotes?: string;
  attributeGains?: Partial<Record<AttributeType, number>>;
  xpEarned?: number;
  goldEarned?: number;
}

// ============================================
// Objectives (Goals)
// ============================================

export type ObjectiveTimeframe = 'short' | 'medium' | 'long';
export type ObjectiveStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Milestone {
  id: UUID;
  title: string;
  isCompleted: boolean;
  completedAt?: ISODateString;
  order: number;
}

export interface Objective extends BaseEntity {
  title: string;
  description?: string;
  timeframe: ObjectiveTimeframe;
  status: ObjectiveStatus;
  progress: number; // 0-100
  milestones: Milestone[];
  startDate: ISODateString;
  targetDate: ISODateString;
  completedAt?: ISODateString;
  xpReward: number;
  relatedActivities?: ActivityCategory[];
}

// ============================================
// Reflections
// ============================================

export type ReflectionType = 'daily' | 'weekly' | 'learning' | 'gratitude' | 'insight';
export type MoodLevel = 'excellent' | 'good' | 'neutral' | 'challenging' | 'difficult';

export interface Reflection extends BaseEntity {
  type: ReflectionType;
  title?: string;
  content: string;
  date: ISODateString;
  mood?: MoodLevel;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  xpEarned: number;
  isPinned?: boolean;
}

// ============================================
// Analytics
// ============================================

export interface DailySnapshot extends BaseEntity {
  date: ISODateString;
  xpEarned: number;
  goldEarned: number;
  activitiesLogged: number;
  questsCompleted: number;
  attributes: Partial<Record<AttributeType, number>>;
  streak: number;
}

export interface WeeklyReport extends BaseEntity {
  weekStart: ISODateString;
  weekEnd: ISODateString;
  totalXP: number;
  totalGold: number;
  activitiesByCategory: Record<ActivityCategory, {
    duration: number;
    count: number;
    xp: number;
  }>;
  questsCompleted: number;
  questsTotal: number;
  attributeChanges: Partial<Record<AttributeType, number>>;
  consistencyScore: number;
  aiSummary?: string;
  aiRecommendations?: string[];
}

// ============================================
// Achievements
// ============================================

export type AchievementCategory = 'streak' | 'milestone' | 'mastery' | 'consistency' | 'special';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: UUID;
  code: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  xpReward: number;
  requirement: {
    type: string;
    target: number;
  };
  isUnlocked: boolean;
  unlockedAt?: ISODateString;
  progress: number;
}

// ============================================
// XP Events
// ============================================

export interface XPEvent {
  id: UUID;
  source: 'activity' | 'quest' | 'objective' | 'reflection' | 'achievement' | 'bonus' | 'check-in';
  sourceId?: UUID;
  amount: number;
  description: string;
  timestamp: ISODateString;
}

// ============================================
// AI Insights
// ============================================

export type InsightType = 'pattern' | 'recommendation' | 'warning' | 'celebration';

export interface AIInsight {
  id: UUID;
  type: InsightType;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: ISODateString;
  isRead: boolean;
}

// ============================================
// Activity Goals (Metas)
// ============================================

export type GoalRecurrence = 'weekly';

export interface ActivityGoal extends BaseEntity {
  category: ActivityCategory;
  recurrence: GoalRecurrence;
  targetDuration: number; // minutos
  targetSessions: number; // número de sessões
  isActive: boolean;
}

export interface GoalProgress {
  goalId: UUID;
  date: ISODateString; // data ou semana (YYYY-WW para weekly)
  currentDuration: number;
  currentSessions: number;
  isCompleted: boolean;
  isFailed: boolean;
}

// ============================================
// Debuffs (Punições)
// ============================================

export type DebuffType =
  | 'xp_reduction'      // Redução de XP ganho
  | 'gold_reduction'    // Redução de gold ganho
  | 'attribute_decay'   // Decay de atributos
  | 'streak_risk';      // Risco de perder streak

export interface Debuff {
  id: UUID;
  type: DebuffType;
  name: string;
  description: string;
  severity: number; // 1-3 (leve, moderado, severo)
  multiplier: number; // ex: 0.8 = 20% de redução
  sourceGoalId?: UUID;
  appliedAt: ISODateString;
  expiresAt: ISODateString;
  isActive: boolean;
}

// ============================================
// Faculdade (Matérias)
// ============================================

export type ExamType = 'prova' | 'trabalho' | 'lista' | 'seminario' | 'outro';

export interface Subject extends BaseEntity {
  name: string;
  professor?: string;
  color: string;
  semester: string;   // ex: "2026.1"
  isActive: boolean;
  canvasId?: number;  // Canvas course ID (se sincronizado)
}

export interface SubjectTopic extends BaseEntity {
  subjectId: UUID;
  title: string;
  isDone: boolean;
  order: number;
}

export interface SubjectExam extends BaseEntity {
  subjectId: UUID;
  title: string;
  type: ExamType;
  scheduledDate: ISODateString; // "YYYY-MM-DD"
  weight: number;               // 0–100 (peso na média)
  grade?: number;               // nota recebida (undefined = não avaliado)
  maxGrade: number;             // nota máxima, default 10
  isDone?: boolean;             // marcado manualmente como concluído
  notes?: string;
  canvasId?: number;            // Canvas assignment ID
}
