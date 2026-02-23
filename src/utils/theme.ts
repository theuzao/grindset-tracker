// Accent color options
export const ACCENT_COLORS = [
  { id: 'blue', name: 'Azul', color: '#2e2ed1', secondary: '#2424a8' },
  { id: 'purple', name: 'Roxo', color: '#5757db', secondary: '#4545b0' },
  { id: 'green', name: 'Verde', color: '#10B981', secondary: '#059669' },
  { id: 'indigo', name: 'Indigo', color: '#6366F1', secondary: '#4F46E5' },
  { id: 'pink', name: 'Rosa', color: '#EC4899', secondary: '#DB2777' },
  { id: 'cyan', name: 'Ciano', color: '#06B6D4', secondary: '#0891B2' },
  { id: 'orange', name: 'Laranja', color: '#F97316', secondary: '#EA580C' },
  { id: 'red', name: 'Vermelho', color: '#EF4444', secondary: '#DC2626' },
];

const STORAGE_KEY = 'grindset-accent-color';

export function getStoredAccentColor(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || '#2e2ed1';
  }
  return '#2e2ed1';
}

export function setStoredAccentColor(color: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, color);
  }
}

export function applyAccentColor(color: string, secondary: string): void {
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', color);
  root.style.setProperty('--accent-secondary', secondary);
  root.style.setProperty('--accent-glow', `${color}33`);

  // Atualizar as classes do Tailwind dinamicamente
  const style = document.getElementById('dynamic-accent-style') || document.createElement('style');
  style.id = 'dynamic-accent-style';
  style.textContent = `
    .bg-accent { background-color: ${color} !important; }
    .text-accent { color: ${color} !important; }
    .border-accent { border-color: ${color} !important; }
    .bg-accent\\/10 { background-color: ${color}1a !important; }
    .bg-accent\\/15 { background-color: ${color}26 !important; }
    .bg-accent\\/20 { background-color: ${color}33 !important; }
    .border-accent\\/20 { border-color: ${color}33 !important; }
    .border-accent\\/30 { border-color: ${color}4d !important; }
    .ring-accent { --tw-ring-color: ${color} !important; }
    .ring-accent\\/50 { --tw-ring-color: ${color}80 !important; }
    .from-accent { --tw-gradient-from: ${color} !important; }
    .to-accent { --tw-gradient-to: ${color} !important; }
    .bg-primary { background-color: ${color} !important; }
    .text-primary { color: ${color} !important; }
    .border-primary { border-color: ${color} !important; }
    .bg-primary\\/10 { background-color: ${color}1a !important; }
    .bg-primary\\/20 { background-color: ${color}33 !important; }
    .border-primary\\/20 { border-color: ${color}33 !important; }
    .border-primary\\/30 { border-color: ${color}4d !important; }
    .shadow-glow { box-shadow: 0 0 20px ${color}4d !important; }
    .shadow-glow-sm { box-shadow: 0 0 10px ${color}33 !important; }
  `;
  if (!document.getElementById('dynamic-accent-style')) {
    document.head.appendChild(style);
  }
}

export function initializeTheme(): void {
  const savedColor = getStoredAccentColor();
  const colorConfig = ACCENT_COLORS.find(c => c.color === savedColor) || ACCENT_COLORS[0];
  applyAccentColor(colorConfig.color, colorConfig.secondary);
}

// Inicializar automaticamente ao importar
initializeTheme();

// ============================================
// Quest Category Colors (Calendar Legend)
// ============================================

export interface QuestCategoryColors {
  daily: string;
  main: string;
  side: string;
}

export const DEFAULT_QUEST_COLORS: QuestCategoryColors = {
  daily: '#2e2ed1',
  main: '#8B5CF6',
  side: '#F59E0B',
};

export const QUEST_COLOR_OPTIONS = [
  { id: 'blue', name: 'Azul', color: '#2e2ed1' },
  { id: 'purple', name: 'Roxo', color: '#8B5CF6' },
  { id: 'violet', name: 'Violeta', color: '#7C3AED' },
  { id: 'indigo', name: 'Indigo', color: '#6366F1' },
  { id: 'cyan', name: 'Ciano', color: '#06B6D4' },
  { id: 'teal', name: 'Turquesa', color: '#14B8A6' },
  { id: 'green', name: 'Verde', color: '#10B981' },
  { id: 'lime', name: 'Lima', color: '#84CC16' },
  { id: 'yellow', name: 'Amarelo', color: '#EAB308' },
  { id: 'orange', name: 'Laranja', color: '#F59E0B' },
  { id: 'red', name: 'Vermelho', color: '#EF4444' },
  { id: 'pink', name: 'Rosa', color: '#EC4899' },
  { id: 'rose', name: 'Rose', color: '#F43F5E' },
  { id: 'gray', name: 'Cinza', color: '#6B7280' },
];

const QUEST_COLORS_STORAGE_KEY = 'grindset-quest-colors';

export function getStoredQuestColors(): QuestCategoryColors {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(QUEST_COLORS_STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_QUEST_COLORS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_QUEST_COLORS;
      }
    }
  }
  return DEFAULT_QUEST_COLORS;
}

export function setStoredQuestColors(colors: Partial<QuestCategoryColors>): void {
  if (typeof window !== 'undefined') {
    const current = getStoredQuestColors();
    const updated = { ...current, ...colors };
    localStorage.setItem(QUEST_COLORS_STORAGE_KEY, JSON.stringify(updated));
  }
}

export function resetQuestColors(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(QUEST_COLORS_STORAGE_KEY);
  }
}
