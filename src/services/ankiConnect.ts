import type {
  AnkiConnectResponse,
  AnkiDeckStatsResponse,
  AnkiCardInfo,
  AnkiCardReviewEntry,
} from '@/features/anki/types';

// Em dev, usa proxy do Vite para evitar CORS. Em prod, acessa direto.
const BASE_URL = import.meta.env.DEV ? '/anki-api' : 'http://localhost:8765';
const API_VERSION = 6;
const TIMEOUT_MS = 5000;

async function invoke<T>(action: string, params?: Record<string, unknown>): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: API_VERSION, params: params ?? {} }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data: AnkiConnectResponse<T> = await response.json();
    if (data.error) {
      console.warn(`[AnkiConnect] ${action} error:`, data.error);
      return null;
    }

    return data.result;
  } catch {
    return null;
  }
}

export const ankiConnectService = {
  async checkConnection(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'version', version: API_VERSION }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  },

  async getDeckNames(): Promise<string[] | null> {
    return invoke<string[]>('deckNames');
  },

  async getDeckStats(decks: string[]): Promise<AnkiDeckStatsResponse | null> {
    return invoke<AnkiDeckStatsResponse>('getDeckStats', { decks });
  },

  async getNumCardsReviewedToday(): Promise<number | null> {
    return invoke<number>('getNumCardsReviewedToday');
  },

  /** Retorna array de [date, count] ex: [["2026-02-13", 45], ...] */
  async getNumCardsReviewedByDay(): Promise<[string, number][] | null> {
    return invoke<[string, number][]>('getNumCardsReviewedByDay');
  },

  async findCards(query: string): Promise<number[] | null> {
    return invoke<number[]>('findCards', { query });
  },

  async cardsInfo(cards: number[]): Promise<AnkiCardInfo[] | null> {
    return invoke<AnkiCardInfo[]>('cardsInfo', { cards });
  },

  /**
   * Retorna reviews de um deck a partir de um timestamp.
   * Cada review é um array de 9 elementos:
   * [reviewTime, cardID, usn, buttonPressed, newInterval, previousInterval, newFactor, duration, type]
   */
  async cardReviews(deck: string, startID: number = 0): Promise<AnkiCardReviewEntry[] | null> {
    const raw = await invoke<number[][]>('cardReviews', { deck, startID });
    if (!raw) return null;

    return raw.map(r => ({
      id: r[0],
      usn: r[2],
      ease: r[3],
      ivl: r[4],
      lastIvl: r[5],
      time: r[7], // duration in ms
    }));
  },

  async getCollectionStatsHTML(wholeCollection = true): Promise<string | null> {
    return invoke<string>('getCollectionStatsHTML', { wholeCollection });
  },
};
