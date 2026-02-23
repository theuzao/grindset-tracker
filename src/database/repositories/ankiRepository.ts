import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import { ankiConnectService } from '@/services/ankiConnect';
import type { AnkiDeck, AnkiReview, AnkiSnapshot } from '@/features/anki/types';

export const ankiRepository = {
  // ============================================
  // Sync Operations
  // ============================================

  async syncDecks(): Promise<AnkiDeck[]> {
    const deckNames = await ankiConnectService.getDeckNames();
    if (!deckNames) return [];

    // Filtrar deck "Default" vazio se houver outros
    const filteredNames = deckNames.filter(n => n !== 'Default' || deckNames.length === 1);

    const stats = await ankiConnectService.getDeckStats(filteredNames);
    if (!stats) return [];

    const now = new Date().toISOString();
    const decks: AnkiDeck[] = [];

    for (const deckStat of Object.values(stats)) {
      // Buscar cards do deck para mature/young/interval
      let matureCards = 0;
      let youngCards = 0;
      let averageInterval = 0;

      const cardIds = await ankiConnectService.findCards(`deck:"${deckStat.name}" is:review`);
      if (cardIds && cardIds.length > 0) {
        // Pegar info em batches de 100
        const batch = cardIds.slice(0, 500);
        const cardsInfoList = await ankiConnectService.cardsInfo(batch);
        if (cardsInfoList) {
          let totalInterval = 0;
          for (const card of cardsInfoList) {
            if (card.interval >= 21) {
              matureCards++;
            } else {
              youngCards++;
            }
            totalInterval += card.interval;
          }
          averageInterval = cardsInfoList.length > 0
            ? Math.round(totalInterval / cardsInfoList.length)
            : 0;
        }
      }

      const deck: AnkiDeck = {
        name: deckStat.name,
        newCount: deckStat.new_count,
        learningCount: deckStat.learn_count,
        reviewCount: deckStat.review_count,
        totalCards: deckStat.total_in_deck,
        matureCards,
        youngCards,
        averageInterval,
        lastSynced: now,
      };

      await db.ankiDecks.put(deck);
      decks.push(deck);
    }

    // Remover decks que não existem mais no Anki
    const existingDecks = await db.ankiDecks.toArray();
    const currentNames = new Set(decks.map(d => d.name));
    for (const existing of existingDecks) {
      if (!currentNames.has(existing.name)) {
        await db.ankiDecks.delete(existing.name);
      }
    }

    return decks;
  },

  async syncTodayReviews(): Promise<void> {
    const today = getLocalDateString();
    const decks = await db.ankiDecks.toArray();

    // Pegar total de reviews hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startTimestamp = todayStart.getTime();

    for (const deck of decks) {
      const reviews = await ankiConnectService.cardReviews(deck.name, startTimestamp);
      if (!reviews || reviews.length === 0) continue;

      const cardsReviewed = reviews.length;
      const timeSpent = Math.round(reviews.reduce((sum, r) => sum + r.time, 0) / 60000); // ms → min
      const correctCount = reviews.filter(r => r.ease >= 2).length;

      // Atualizar ou criar review para esse deck/dia
      const existing = await db.ankiReviews
        .where('[deckName+date]')
        .equals([deck.name, today])
        .first();

      if (existing && existing.source === 'anki') {
        await db.ankiReviews.update(existing.id, {
          cardsReviewed,
          timeSpent,
          correctCount,
        });
      } else if (!existing) {
        const review: AnkiReview = {
          id: uuid(),
          deckName: deck.name,
          date: today,
          cardsReviewed,
          timeSpent,
          correctCount,
          source: 'anki',
          createdAt: new Date().toISOString(),
        };
        await db.ankiReviews.add(review);
      }
      // Se existing.source === 'manual', não sobrescrever
    }
  },

  async createSnapshot(): Promise<AnkiSnapshot | null> {
    const today = getLocalDateString();

    // Verificar se já tem snapshot para hoje
    const existing = await db.ankiSnapshots
      .where('date')
      .equals(today)
      .first();

    const todayReviews = await this.getReviewsByDate(today);
    const totalReviews = todayReviews.reduce((sum, r) => sum + r.cardsReviewed, 0);
    const totalTime = todayReviews.reduce((sum, r) => sum + r.timeSpent, 0);
    const totalCorrect = todayReviews.reduce((sum, r) => sum + r.correctCount, 0);
    const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    const decks = await db.ankiDecks.toArray();
    const totalNew = decks.reduce((sum, d) => sum + d.newCount, 0);
    const matureCards = decks.reduce((sum, d) => sum + d.matureCards, 0);
    const youngCards = decks.reduce((sum, d) => sum + d.youngCards, 0);

    const snapshot: AnkiSnapshot = {
      id: existing?.id ?? uuid(),
      date: today,
      totalReviews,
      totalNew,
      totalTime,
      accuracy,
      matureCards,
      youngCards,
      isOnline: true,
    };

    await db.ankiSnapshots.put(snapshot);
    return snapshot;
  },

  // ============================================
  // Manual Review Tracking
  // ============================================

  async markManualReview(
    deckName: string,
    cardsReviewed: number,
    date?: string,
  ): Promise<AnkiReview> {
    const reviewDate = date ?? getLocalDateString();

    // Verificar se já existe review manual para esse deck/dia
    const existing = await db.ankiReviews
      .where('[deckName+date]')
      .equals([deckName, reviewDate])
      .filter(r => r.source === 'manual')
      .first();

    if (existing) {
      await db.ankiReviews.update(existing.id, {
        cardsReviewed: existing.cardsReviewed + cardsReviewed,
      });
      return { ...existing, cardsReviewed: existing.cardsReviewed + cardsReviewed };
    }

    const review: AnkiReview = {
      id: uuid(),
      deckName,
      date: reviewDate,
      cardsReviewed,
      timeSpent: 0,
      correctCount: 0,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    await db.ankiReviews.add(review);
    return review;
  },

  async undoManualReview(id: string): Promise<void> {
    const review = await db.ankiReviews.get(id);
    if (review && review.source === 'manual') {
      await db.ankiReviews.delete(id);
    }
  },

  // ============================================
  // Query Operations
  // ============================================

  async getAllDecks(): Promise<AnkiDeck[]> {
    return db.ankiDecks.toArray();
  },

  async getReviewsByDate(date: string): Promise<AnkiReview[]> {
    return db.ankiReviews.where('date').equals(date).toArray();
  },

  async getTodayReviews(): Promise<AnkiReview[]> {
    return this.getReviewsByDate(getLocalDateString());
  },

  async getTodayTotalReviews(): Promise<number> {
    const reviews = await this.getTodayReviews();
    return reviews.reduce((sum, r) => sum + r.cardsReviewed, 0);
  },

  async getLatestSnapshot(): Promise<AnkiSnapshot | undefined> {
    return db.ankiSnapshots.orderBy('date').reverse().first();
  },

  async getStreak(): Promise<number> {
    const allReviews = await db.ankiReviews.orderBy('date').reverse().toArray();
    if (allReviews.length === 0) return 0;

    // Agrupar por data
    const dateSet = new Set(allReviews.map(r => r.date));
    const dates = Array.from(dateSet).sort().reverse();

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedDate = getLocalDateString(expected);

      if (dates.includes(expectedDate)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },

  async getWeeklyData(): Promise<{ date: string; count: number; timeSpent: number }[]> {
    const result: { date: string; count: number; timeSpent: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);

      const reviews = await db.ankiReviews
        .where('date')
        .equals(dateStr)
        .toArray();

      const count = reviews.reduce((sum, r) => sum + r.cardsReviewed, 0);
      const timeSpent = reviews.reduce((sum, r) => sum + r.timeSpent, 0);
      result.push({ date: dateStr, count, timeSpent });
    }

    return result;
  },

  async getHeatmapData(months = 3): Promise<{ date: string; count: number }[]> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    const startStr = getLocalDateString(startDate);

    const reviews = await db.ankiReviews
      .where('date')
      .aboveOrEqual(startStr)
      .toArray();

    // Agrupar por data
    const grouped: Record<string, number> = {};
    for (const r of reviews) {
      grouped[r.date] = (grouped[r.date] || 0) + r.cardsReviewed;
    }

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async syncForecast(): Promise<{ date: string; dueCards: number }[]> {
    const result: { date: string; dueCards: number }[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = getLocalDateString(d);

      if (i === 0) {
        const decks = await db.ankiDecks.toArray();
        const totalDue = decks.reduce((sum, dk) => sum + dk.reviewCount + dk.learningCount + dk.newCount, 0);
        result.push({ date: dateStr, dueCards: totalDue });
      } else {
        const query = `prop:due=${i}`;
        const cardIds = await ankiConnectService.findCards(query);
        result.push({ date: dateStr, dueCards: cardIds?.length ?? 0 });
      }
    }

    // Cache no localStorage para funcionar offline
    localStorage.setItem('anki-forecast', JSON.stringify(result));
    return result;
  },

  getForecast(): { date: string; dueCards: number }[] {
    const cached = localStorage.getItem('anki-forecast');
    if (!cached) return [];
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  },

  async clearAllData(): Promise<void> {
    await db.ankiDecks.clear();
    await db.ankiReviews.clear();
    await db.ankiSnapshots.clear();
  },
};
