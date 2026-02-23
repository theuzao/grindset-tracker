import type { AnkiConfig } from './types';

const STORAGE_KEY = 'anki-config';

const DEFAULT_CONFIG: AnkiConfig = {
  enabled: true,
  autoQuest: {
    enabled: true,
    threshold: 20,
    title: 'Revisar Anki',
    difficulty: 'medium',
  },
};

export function getAnkiConfig(): AnkiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

export function setAnkiConfig(config: Partial<AnkiConfig>): void {
  const current = getAnkiConfig();
  const merged = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function updateAutoQuestConfig(config: Partial<AnkiConfig['autoQuest']>): void {
  const current = getAnkiConfig();
  setAnkiConfig({
    autoQuest: { ...current.autoQuest, ...config },
  });
}
