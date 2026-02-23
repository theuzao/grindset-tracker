import { create } from 'zustand';
import { ankiConnectService } from './ankiConnect';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { getAnkiConfig } from '@/features/anki/ankiConfig';

interface AnkiSyncState {
  isConnected: boolean;
  lastSync: string | null;
  isSyncing: boolean;
  setConnected: (connected: boolean) => void;
  setLastSync: (date: string | null) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useAnkiSyncStore = create<AnkiSyncState>((set) => ({
  isConnected: false,
  lastSync: null,
  isSyncing: false,
  setConnected: (connected) => set({ isConnected: connected }),
  setLastSync: (date) => set({ lastSync: date }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}));

let syncInterval: ReturnType<typeof setInterval> | null = null;

async function performSync(): Promise<void> {
  const store = useAnkiSyncStore.getState();
  if (store.isSyncing) return;

  store.setSyncing(true);

  try {
    const connected = await ankiConnectService.checkConnection();
    store.setConnected(connected);

    if (!connected) {
      store.setSyncing(false);
      return;
    }

    // Sync decks, reviews e previsão
    await ankiRepository.syncDecks();
    await ankiRepository.syncTodayReviews();
    await ankiRepository.createSnapshot();
    await ankiRepository.syncForecast();

    // Auto quest
    const config = getAnkiConfig();
    if (config.autoQuest.enabled) {
      const { ankiAutoQuestService } = await import('@/features/anki/ankiAutoQuest');
      await ankiAutoQuestService.ensureTodayQuest();
      await ankiAutoQuestService.checkAndComplete();
    }

    store.setLastSync(new Date().toISOString());
  } catch (error) {
    console.error('[Anki Sync] Falha:', error);
  } finally {
    store.setSyncing(false);
  }
}

export const ankiSyncService = {
  startAutoSync(intervalMs = 300000): void {
    // Sync imediato
    performSync();

    // Polling
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(performSync, intervalMs);
  },

  stopAutoSync(): void {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  },

  async syncNow(): Promise<void> {
    await performSync();
  },
};
