import { getLocalDateString } from '@/database/db';
import { questRepository } from '@/database/repositories/questRepository';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { getAnkiConfig } from './ankiConfig';

const ANKI_QUEST_TAG = '[anki-auto]';

export const ankiAutoQuestService = {
  async getAnkiQuestForToday() {
    const today = getLocalDateString();
    const config = getAnkiConfig();
    const quests = await questRepository.getByDate(today);
    return quests.find(
      q => q.description?.includes(ANKI_QUEST_TAG) || q.title === config.autoQuest.title,
    );
  },

  async ensureTodayQuest() {
    const config = getAnkiConfig();
    if (!config.autoQuest.enabled) return null;

    const existing = await this.getAnkiQuestForToday();
    if (existing) return existing;

    const today = getLocalDateString();
    return questRepository.create({
      title: config.autoQuest.title,
      description: `${ANKI_QUEST_TAG} Revisar pelo menos ${config.autoQuest.threshold} cards no Anki`,
      category: 'daily',
      difficulty: config.autoQuest.difficulty,
      recurrence: 'once', // Auto-criada diariamente pelo sync, não pelo sistema de recurrence
      scheduledDate: today,
      relatedActivity: 'study',
    });
  },

  async checkAndComplete(): Promise<boolean> {
    const config = getAnkiConfig();
    if (!config.autoQuest.enabled) return false;

    const quest = await this.getAnkiQuestForToday();
    if (!quest || quest.status !== 'pending') return false;

    const totalReviews = await ankiRepository.getTodayTotalReviews();
    if (totalReviews >= config.autoQuest.threshold) {
      await questRepository.complete(quest.id, `Auto-completada: ${totalReviews} cards revisados`);
      return true;
    }

    return false;
  },
};
