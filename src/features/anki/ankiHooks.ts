import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLocalDateString } from '@/database/db';
import type { AnkiDeck, AnkiReview, AnkiSnapshot } from './types';

export function useAnkiDecks(): AnkiDeck[] | undefined {
  return useLiveQuery(() => db.ankiDecks.toArray(), []);
}

export function useAnkiTodayReviews(): AnkiReview[] | undefined {
  const today = getLocalDateString();
  return useLiveQuery(
    () => db.ankiReviews.where('date').equals(today).toArray(),
    [],
  );
}

export function useAnkiLatestSnapshot(): AnkiSnapshot | undefined {
  return useLiveQuery(
    () => db.ankiSnapshots.orderBy('date').reverse().first(),
    [],
  );
}

export function useAnkiSnapshotByDate(date: string): AnkiSnapshot | undefined {
  return useLiveQuery(
    () => db.ankiSnapshots.where('date').equals(date).first(),
    [date],
  );
}

export function useAnkiReviewsByDate(date: string): AnkiReview[] | undefined {
  return useLiveQuery(
    () => db.ankiReviews.where('date').equals(date).toArray(),
    [date],
  );
}
