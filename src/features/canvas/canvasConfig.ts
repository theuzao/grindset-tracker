interface CanvasConfig {
  enabled: boolean;
  baseUrl: string;  // ex: "https://suauniversidade.instructure.com"
  token: string;
}

const STORAGE_KEY = 'canvas-config';

const DEFAULT_CONFIG: CanvasConfig = {
  enabled: false,
  baseUrl: '',
  token: '',
};

export function getCanvasConfig(): CanvasConfig {
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

export function setCanvasConfig(updates: Partial<CanvasConfig>): void {
  const current = getCanvasConfig();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
}

// Cursos do Canvas que o usuário deletou manualmente — nunca reimportar
const IGNORED_KEY = 'canvas-ignored-course-ids';

export function getIgnoredCanvasCourseIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(IGNORED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function addIgnoredCanvasCourseId(id: number): void {
  const current = getIgnoredCanvasCourseIds();
  if (!current.includes(id)) {
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...current, id]));
  }
}

export function clearIgnoredCanvasCourseIds(): void {
  localStorage.removeItem(IGNORED_KEY);
}
