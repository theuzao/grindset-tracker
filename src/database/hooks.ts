import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLocalDateString } from './db';
import type {
  Character,
  ActivityLog,
  Quest,
  Objective,
  Reflection,
  ActivityCategory,
  QuestStatus,
  ObjectiveStatus,
  ObjectiveTimeframe,
  CheckIn,
  CheckInStreak,
  GoalProgress,
  Subject,
  SubjectTopic,
  SubjectExam,
} from '@/types';

// ============================================
// Character Hooks
// ============================================

export function useCharacter(): Character | null | undefined {
  return useLiveQuery(async () => {
    const character = await db.character.toCollection().first();
    return character ?? null;
  });
}

// ============================================
// Activity Hooks
// ============================================

export function useActivities(
  category?: ActivityCategory,
  limit = 50
): ActivityLog[] | undefined {
  return useLiveQuery(async () => {
    let query = db.activities.orderBy('completedAt').reverse();

    if (category) {
      const activities = await db.activities
        .where('category')
        .equals(category)
        .reverse()
        .sortBy('completedAt');
      return activities.slice(0, limit);
    }

    return query.limit(limit).toArray();
  }, [category, limit]);
}

export function useActivitiesByDateRange(
  startDate: string,
  endDate: string
): ActivityLog[] | undefined {
  return useLiveQuery(
    () =>
      db.activities
        .where('completedAt')
        .between(startDate, endDate, true, true)
        .toArray(),
    [startDate, endDate]
  );
}

export function useTodayActivities(): ActivityLog[] | undefined {
  const today = getLocalDateString();
  return useLiveQuery(
    () =>
      db.activities
        .where('completedAt')
        .startsWith(today)
        .toArray(),
    []
  );
}

// ============================================
// Quest Hooks
// ============================================

export function useQuests(
  status?: QuestStatus,
  date?: string
): Quest[] | undefined {
  return useLiveQuery(async () => {
    if (status && date) {
      return db.quests
        .where('[status+scheduledDate]')
        .equals([status, date])
        .toArray();
    }

    if (status) {
      return db.quests.where('status').equals(status).toArray();
    }

    if (date) {
      return db.quests.where('scheduledDate').equals(date).toArray();
    }

    return db.quests.toArray();
  }, [status, date]);
}

export function useTodayQuests(): Quest[] | undefined {
  const today = getLocalDateString();
  return useLiveQuery(
    () => db.quests.where('scheduledDate').equals(today).toArray(),
    []
  );
}

export function usePendingQuests(): Quest[] | undefined {
  return useLiveQuery(
    () => db.quests.where('status').equals('pending').toArray(),
    []
  );
}

export function useOverdueQuests(): Quest[] | undefined {
  const today = getLocalDateString();
  return useLiveQuery(
    () => db.quests
      .where('status')
      .equals('pending')
      .toArray()
      .then(quests =>
        quests
          .filter(q => q.scheduledDate < today)
          .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      ),
    []
  );
}

export function useRecentCompletedQuests(limit = 20): Quest[] | undefined {
  return useLiveQuery(
    () => db.quests
      .where('status')
      .anyOf(['completed', 'failed'])
      .toArray()
      .then(quests =>
        quests
          .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || ''))
          .slice(0, limit)
      ),
    [limit]
  );
}

// ============================================
// Objective Hooks
// ============================================

export function useObjectives(
  status?: ObjectiveStatus,
  timeframe?: ObjectiveTimeframe
): Objective[] | undefined {
  return useLiveQuery(async () => {
    if (status && timeframe) {
      return db.objectives
        .where('[status+timeframe]')
        .equals([status, timeframe])
        .toArray();
    }

    if (status) {
      return db.objectives.where('status').equals(status).toArray();
    }

    if (timeframe) {
      return db.objectives.where('timeframe').equals(timeframe).toArray();
    }

    return db.objectives.toArray();
  }, [status, timeframe]);
}

export function useActiveObjectives(): Objective[] | undefined {
  return useLiveQuery(
    () => db.objectives.where('status').equals('active').toArray(),
    []
  );
}

// ============================================
// Reflection Hooks
// ============================================

export function useReflections(limit = 20): Reflection[] | undefined {
  return useLiveQuery(
    () => db.reflections.orderBy('date').reverse().limit(limit).toArray(),
    [limit]
  );
}

export function usePinnedReflections(): Reflection[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.reflections.toArray();
    return all
      .filter(r => r.isPinned === true)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, []);
}

export function useReflectionsByDateRange(
  startDate: string,
  endDate: string
): Reflection[] | undefined {
  return useLiveQuery(
    () =>
      db.reflections
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray(),
    [startDate, endDate]
  );
}

// ============================================
// Analytics Hooks
// ============================================

export function useDailySnapshot(date: string) {
  return useLiveQuery(
    () => db.dailySnapshots.where('date').equals(date).first(),
    [date]
  );
}

export function useWeeklyReport(weekStart: string) {
  return useLiveQuery(
    () => db.weeklyReports.where('weekStart').equals(weekStart).first(),
    [weekStart]
  );
}

export function useXPEvents(limit = 50) {
  return useLiveQuery(
    () => db.xpEvents.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit]
  );
}

// ============================================
// Achievement Hooks
// ============================================

export function useAchievements(unlockedOnly = false) {
  return useLiveQuery(async () => {
    if (unlockedOnly) {
      return db.achievements.where('isUnlocked').equals(1).toArray();
    }
    return db.achievements.toArray();
  }, [unlockedOnly]);
}

// ============================================
// AI Insight Hooks
// ============================================

export function useAIInsights(unreadOnly = false) {
  return useLiveQuery(async () => {
    if (unreadOnly) {
      return db.aiInsights.where('isRead').equals(0).toArray();
    }
    return db.aiInsights.orderBy('createdAt').reverse().toArray();
  }, [unreadOnly]);
}

// ============================================
// Activity Goals Hooks
// ============================================

export function useActivityGoals(activeOnly = true) {
  return useLiveQuery(async () => {
    const all = await db.activityGoals.toArray();
    if (activeOnly) {
      return all.filter(g => g.isActive);
    }
    return all;
  }, [activeOnly]);
}

export function useGoalsByCategory(category: ActivityCategory) {
  return useLiveQuery(
    () => db.activityGoals.where('category').equals(category).toArray(),
    [category]
  );
}

// Busca progresso de uma meta para os últimos 7 dias
export function useWeeklyGoalProgress(goalId: string | undefined): GoalProgress[] | undefined {
  return useLiveQuery(async () => {
    if (!goalId) return [];
    const today = new Date();
    const result: GoalProgress[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = getLocalDateString(d);
      const progress = await db.goalProgress
        .where('[goalId+date]')
        .equals([goalId, dateKey])
        .first();
      result.push(progress || {
        goalId,
        date: dateKey,
        currentDuration: 0,
        currentSessions: 0,
        isCompleted: false,
        isFailed: false,
      });
    }
    return result;
  }, [goalId]);
}

// ============================================
// Debuff Hooks
// ============================================

export function useActiveDebuffs() {
  return useLiveQuery(async () => {
    const now = new Date().toISOString();
    return db.debuffs
      .where('isActive')
      .equals(1)
      .filter(d => d.expiresAt > now)
      .toArray();
  }, []);
}

// ============================================
// Custom Category Hooks
// ============================================

export function useCustomCategories(activeOnly = false) {
  return useLiveQuery(async () => {
    try {
      const all = await db.customCategories.toArray();
      if (activeOnly) {
        return all.filter(c => c.isActive === true);
      }
      return all;
    } catch {
      return [];
    }
  }, [activeOnly]);
}

// ============================================
// Check-in Hooks
// ============================================

export function useTodayCheckIns(): CheckIn[] | undefined {
  const today = getLocalDateString();
  return useLiveQuery(
    () => db.checkIns.where('date').equals(today).toArray(),
    []
  );
}

export function useCheckInStreak(
  category: ActivityCategory
): CheckInStreak | undefined {
  return useLiveQuery(
    () => db.checkInStreaks.get(category),
    [category]
  );
}

export function useAllCheckInStreaks(): CheckInStreak[] | undefined {
  return useLiveQuery(() => db.checkInStreaks.toArray(), []);
}

export function useMonthlyCheckIns(
  category: ActivityCategory,
  year: number,
  month: number
): number[] | undefined {
  return useLiveQuery(async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const checkIns = await db.checkIns
      .where('[category+date]')
      .between([category, startDate], [category, endDate], true, true)
      .toArray();

    return checkIns.map(c => parseInt(c.date.split('-')[2]));
  }, [category, year, month]);
}

export function useQuestsByMonth(
  year: number,
  month: number
): Quest[] | undefined {
  return useLiveQuery(async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    return db.quests
      .where('scheduledDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }, [year, month]);
}

export function useQuestsByDate(date: string): Quest[] | undefined {
  return useLiveQuery(
    () => db.quests.where('scheduledDate').equals(date).toArray(),
    [date]
  );
}

export function useUpcomingQuests(days = 30): Quest[] | undefined {
  return useLiveQuery(async () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const startStr = getLocalDateString(today);
    const endStr = getLocalDateString(endDate);

    return db.quests
      .where('scheduledDate')
      .between(startStr, endStr, true, true)
      .toArray();
  }, [days]);
}

export function useAllCheckInsByMonth(
  year: number,
  month: number
): CheckIn[] | undefined {
  return useLiveQuery(async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    return db.checkIns
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }, [year, month]);
}

export function useCheckInsByDate(date: string): CheckIn[] | undefined {
  return useLiveQuery(
    () => db.checkIns.where('date').equals(date).toArray(),
    [date]
  );
}

// ============================================
// Faculdade Hooks
// ============================================

export function useSubjects(activeOnly = false): Subject[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.subjects.toArray();
    const sorted = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (activeOnly) return sorted.filter(s => s.isActive);
    return sorted;
  }, [activeOnly]);
}

export function useSubjectTopics(subjectId: string): SubjectTopic[] | undefined {
  return useLiveQuery(async () => {
    if (!subjectId) return [];
    const topics = await db.subjectTopics.where('subjectId').equals(subjectId).toArray();
    return topics.sort((a, b) => a.order - b.order);
  }, [subjectId]);
}

export function useSubjectExams(subjectId?: string): SubjectExam[] | undefined {
  return useLiveQuery(async () => {
    if (subjectId) {
      const exams = await db.subjectExams.where('subjectId').equals(subjectId).toArray();
      return exams.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    }
    const all = await db.subjectExams.toArray();
    return all.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [subjectId]);
}

export function useUpcomingExams(days = 30): SubjectExam[] | undefined {
  return useLiveQuery(async () => {
    const today = getLocalDateString();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = getLocalDateString(future);
    const exams = await db.subjectExams
      .where('scheduledDate')
      .between(today, futureStr, true, true)
      .toArray();
    return exams.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [days]);
}
