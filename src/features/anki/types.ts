// ============================================
// Anki Integration Types
// ============================================

export type AnkiConnectionStatus = 'connected' | 'disconnected' | 'checking';

export interface AnkiDeck {
  name: string;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  totalCards: number;
  matureCards: number;
  youngCards: number;
  averageInterval: number;
  lastSynced: string;
}

export interface AnkiReview {
  id: string;
  deckName: string;
  date: string; // YYYY-MM-DD
  cardsReviewed: number;
  timeSpent: number; // minutos
  correctCount: number;
  source: 'anki' | 'manual';
  createdAt: string;
}

export interface AnkiSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  totalReviews: number;
  totalNew: number;
  totalTime: number; // minutos
  accuracy: number; // 0-100
  matureCards: number;
  youngCards: number;
  isOnline: boolean;
}

export interface AnkiQuestConfig {
  enabled: boolean;
  threshold: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AnkiConfig {
  enabled: boolean;
  autoQuest: AnkiQuestConfig;
}

// AnkiConnect API response types
export interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

export interface AnkiDeckStatsResponse {
  [deckId: string]: {
    deck_id: number;
    name: string;
    new_count: number;
    learn_count: number;
    review_count: number;
    total_in_deck: number;
  };
}

export interface AnkiCardInfo {
  cardId: number;
  interval: number;
  type: number; // 0=new, 1=learning, 2=review, 3=relearning
  due: number;
  queue: number;
  deckName: string;
}

export interface AnkiCardReviewEntry {
  id: number;
  usn: number;
  ease: number; // 1=again, 2=hard, 3=good, 4=easy
  ivl: number;
  lastIvl: number;
  time: number; // ms
}
