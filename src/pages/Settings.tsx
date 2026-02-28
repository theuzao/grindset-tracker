import { useState, useEffect, useRef, useMemo } from 'react';
import type { ActivityConfig, CustomAttributeImpact } from '@/types';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  Edit3,
  Zap,
  AlertTriangle,
  X,
  User,
  FileText,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ActivityIcon, ACTIVITY_ICON_NAMES, ACTIVITY_ICON_LABELS } from '@/components/ui/ActivityIcon';
import { db, exportAllData, exportFullReport, importAllData, resetDatabase } from '@/database/db';
import { getAnkiConfig, setAnkiConfig, updateAutoQuestConfig } from '@/features/anki/ankiConfig';
import { getCanvasConfig, setCanvasConfig, clearIgnoredCanvasCourseIds } from '@/features/canvas/canvasConfig';
import { canvasService, type CanvasCourse } from '@/services/canvasService';
import { useActivityGoals, useActiveDebuffs, useCustomCategories } from '@/database/hooks';
import { goalRepository } from '@/database/repositories/goalRepository';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { ACTIVITY_CONFIGS, INITIAL_ATTRIBUTES } from '@/features/gamification/constants';
import {
  ACCENT_COLORS,
  getStoredAccentColor,
  setStoredAccentColor,
  applyAccentColor,
  QUEST_COLOR_OPTIONS,
  getStoredQuestColors,
  setStoredQuestColors,
  type QuestCategoryColors,
} from '@/utils/theme';
import type { ActivityCategory, ActivityGoal, CustomActivityCategory, AttributeType } from '@/types';

// ─── Shared card class ────────────────────────────────────────────────────────
const CARD = 'bg-[#111118] border border-white/[0.07] rounded-2xl p-7 relative overflow-hidden hover:border-white/[0.13] transition-colors';

// ─── Top gradient accent line for each card ───────────────────────────────────
function CardGlow({ color = 'rgba(124,111,255,0.3)' }: { color?: string }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-px"
      style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
    />
  );
}

// ─── Card icon container ──────────────────────────────────────────────────────
function CardIcon({ emoji, bg }: { emoji: string; bg: string }) {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
      style={{ background: bg }}
    >
      {emoji}
    </div>
  );
}

// ─── Field label with accent dot ─────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="w-[5px] h-[5px] rounded-full bg-accent inline-block shrink-0" />
      <span className="font-mono text-[11px] text-gray-500 tracking-[0.08em] uppercase">{children}</span>
    </div>
  );
}

// ─── Card action button (header area) ────────────────────────────────────────
function CardActionBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#1e1e28] border border-white/[0.07] text-gray-200 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-[0.04em] flex items-center gap-1.5 hover:bg-accent/15 hover:border-accent hover:text-accent transition-all"
    >
      {children}
    </button>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-xl relative cursor-pointer border transition-all shrink-0 ${
        value
          ? 'bg-accent border-accent shadow-[0_0_12px_rgba(124,111,255,0.4)]'
          : 'bg-[#1e1e28] border-white/[0.07]'
      }`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${
          value ? 'translate-x-[25px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

// ─── Icon action button (edit / delete in lists) ──────────────────────────────
function IconBtn({
  onClick,
  danger,
  title,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-7 h-7 bg-[#1e1e28] border border-white/[0.07] rounded-[7px] flex items-center justify-center text-gray-500 transition-all ${
        danger
          ? 'hover:border-red-500 hover:text-red-400 hover:bg-red-500/10'
          : 'hover:border-accent hover:text-accent hover:bg-accent/10'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="xl:col-span-2 flex items-center gap-4 my-1">
      <div className="flex-1 h-px bg-white/[0.07]" />
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-600 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.07]" />
    </div>
  );
}

// ─── "Em breve" badge ─────────────────────────────────────────────────────────
function SoonBadge() {
  return (
    <span className="font-mono text-[10px] px-2 py-0.5 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 tracking-[0.05em] shrink-0">
      EM BREVE
    </span>
  );
}

// ─── Data action button ───────────────────────────────────────────────────────
function DataBtn({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: 'export' | 'import' | 'generate' | 'danger';
  children: React.ReactNode;
}) {
  const styles = {
    export: 'bg-[rgba(78,205,196,0.1)] text-[#4ecdc4] border-[rgba(78,205,196,0.2)] hover:bg-[rgba(78,205,196,0.2)]',
    import: 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20',
    generate: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20 hover:bg-yellow-400/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all tracking-[0.04em] whitespace-nowrap disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

// ─── Main Settings component ──────────────────────────────────────────────────

export function Settings() {
  const activityGoals = useActivityGoals(false);
  const activeDebuffs = useActiveDebuffs();
  const customCategories = useCustomCategories();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ActivityGoal | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomActivityCategory | null>(null);
  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grindset-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Erro ao exportar dados');
    }
  };

  const handleFullReportExport = async () => {
    try {
      const report = await exportFullReport();
      const date = new Date().toISOString().split('T')[0];
      const last7Days = report.last7Days as {
        checkIns: unknown[];
        quests: unknown[];
        reflections: unknown[];
        xpEvents: unknown[];
      };

      const jsonBlob = new Blob([JSON.stringify(report.rawData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `grindset-dados-completos-${date}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      const markdownContent = `# Relatório GRINDSET - ${date}

## Resumo dos Últimos 7 Dias

${JSON.stringify(report.summary, null, 2)}

---

## Dados dos Últimos 7 Dias

### Check-ins (${last7Days.checkIns.length})
\`\`\`json
${JSON.stringify(last7Days.checkIns, null, 2)}
\`\`\`

### Quests (${last7Days.quests.length})
\`\`\`json
${JSON.stringify(last7Days.quests, null, 2)}
\`\`\`

### Reflexões (${last7Days.reflections.length})
\`\`\`json
${JSON.stringify(last7Days.reflections, null, 2)}
\`\`\`

### Eventos de XP (${last7Days.xpEvents.length})
\`\`\`json
${JSON.stringify(last7Days.xpEvents, null, 2)}
\`\`\`

---

${report.aiAnalysisPrompt}
`;

      const mdBlob = new Blob([markdownContent], { type: 'text/markdown' });
      const mdUrl = URL.createObjectURL(mdBlob);
      const mdLink = document.createElement('a');
      mdLink.href = mdUrl;
      mdLink.download = `grindset-relatorio-ia-${date}.md`;
      setTimeout(() => {
        mdLink.click();
        URL.revokeObjectURL(mdUrl);
      }, 500);

      alert('Exportação completa! Dois arquivos foram baixados:\n\n1. Dados completos (.json)\n2. Relatório com prompt de IA (.md)');
    } catch (error) {
      console.error('Full report export failed:', error);
      alert('Erro ao exportar relatório completo');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      alert('Por favor, selecione um arquivo JSON válido');
      return;
    }
    if (!window.confirm('Importar dados irá SUBSTITUIR os dados existentes com os mesmos IDs. Deseja continuar?')) {
      e.target.value = '';
      return;
    }
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const validKeys = [
        'character', 'activities', 'quests', 'objectives', 'reflections',
        'weeklyReports', 'achievements', 'xpEvents', 'dailySnapshots',
        'aiInsights', 'activityGoals', 'goalProgress', 'debuffs', 'customCategories',
      ];
      if (!Object.keys(data).some(key => validKeys.includes(key))) {
        throw new Error('Arquivo de backup inválido: estrutura não reconhecida');
      }
      await importAllData(data);
      alert('Dados importados com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Erro ao importar dados: ${error instanceof Error ? error.message : 'Arquivo inválido'}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (window.confirm('Tem certeza que deseja resetar todos os dados? Esta ação é irreversível!')) {
      if (window.confirm('ÚLTIMA CHANCE: Todos os seus dados serão perdidos. Continuar?')) {
        try {
          await resetDatabase();
          window.location.reload();
        } catch (error) {
          console.error('Reset failed:', error);
          alert('Erro ao resetar dados');
        }
      }
    }
  };

  const handleResetCharacter = async () => {
    if (window.confirm('Resetar personagem? Você voltará ao nível 1 e perderá todo XP, Gold e atributos. Seu nome será mantido.')) {
      try {
        const character = await db.character.toCollection().first();
        if (!character) { alert('Personagem não encontrado'); return; }
        const now = new Date().toISOString();
        const initialAttributes: Record<AttributeType, { type: AttributeType; name: string; icon: string; color: string; currentValue: number; baseValue: number }> = {} as any;
        for (const [key, attr] of Object.entries(INITIAL_ATTRIBUTES)) {
          initialAttributes[key as AttributeType] = { type: key as AttributeType, name: attr.name, icon: attr.icon, color: attr.color, currentValue: 0, baseValue: 0 };
        }
        await db.character.update(character.id, {
          level: 1, currentXP: 0, totalXP: 0, gold: 0, pendingPenalty: 0,
          title: 'Iniciante', attributes: initialAttributes,
          streak: { current: 0, longest: 0, lastActiveDate: now }, updatedAt: now,
        });
        await db.xpEvents.clear();
        await db.debuffs.clear();
        window.location.reload();
      } catch (error) {
        console.error('Reset character failed:', error);
        alert('Erro ao resetar personagem');
      }
    }
  };

  const handleEditGoal = (goal: ActivityGoal) => { setEditingGoal(goal); setShowGoalModal(true); };
  const handleDeleteGoal = async (goalId: string) => {
    if (window.confirm('Remover esta meta?')) await goalRepository.delete(goalId);
  };
  const handleToggleGoal = async (goalId: string) => goalRepository.toggleActive(goalId);
  const handleEditCategory = (category: CustomActivityCategory) => { setEditingCategory(category); setShowCategoryModal(true); };
  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Remover esta categoria?')) await categoryRepository.delete(categoryId);
  };
  const handleToggleCategory = async (categoryId: string) => categoryRepository.toggleActive(categoryId);

  return (
    <div className="min-h-screen">
      {/* Page Title */}
      <div className="px-6 pt-6 pb-2 max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-[38px] font-extrabold tracking-tight leading-none mb-2">
            Con<span className="bg-gradient-to-r from-accent to-[#4ecdc4] bg-clip-text text-transparent">figurações</span>
          </h1>
          <p className="text-sm text-gray-500 font-mono tracking-[0.05em]">// personalize sua experiência</p>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-6xl mx-auto">

        {/* Active Debuffs Warning */}
        {activeDebuffs && activeDebuffs.length > 0 && (
          <div className="bg-[#111118] border border-red-500/20 rounded-2xl p-7 mb-5 relative overflow-hidden">
            <CardGlow color="rgba(255,71,87,0.3)" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 shrink-0">
                <AlertTriangle size={15} className="text-red-400" />
              </div>
              <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase text-red-400">Debuffs Ativos</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeDebuffs.map((debuff) => {
                const remainingMs = new Date(debuff.expiresAt).getTime() - Date.now();
                const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                return (
                  <div key={debuff.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div>
                      <p className="font-semibold text-red-400 text-sm">{debuff.name}</p>
                      <p className="text-xs text-red-400/70 font-mono">{debuff.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">-{Math.round((1 - debuff.multiplier) * 100)}%</p>
                      <p className="text-xs text-red-400/70 font-mono">
                        {remainingHours > 0 ? `${remainingHours}h ${remainingMinutes}m` : `${remainingMinutes}m`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* ── Aparência ── */}
          <div className={CARD}>
            <CardGlow />
            <div className="flex items-center gap-2.5 mb-6">
              <CardIcon emoji="🎨" bg="rgba(124,111,255,0.15)" />
              <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Aparência</h2>
            </div>
            {/* Tema */}
            <div className="mb-5">
              <FieldLabel>Tema</FieldLabel>
              <div className="flex items-center justify-between px-4 py-3 bg-[#18181f] rounded-xl border border-white/[0.07]">
                <span className="text-sm font-semibold">Dark</span>
                <SoonBadge />
              </div>
            </div>
            <AccentColorPicker />
            <QuestColorsPicker />
          </div>

          {/* ── Metas de Atividade ── */}
          <div className={CARD}>
            <CardGlow color="rgba(255,217,61,0.3)" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <CardIcon emoji="🎯" bg="rgba(255,217,61,0.15)" />
                <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Metas de Atividade</h2>
              </div>
              <CardActionBtn onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}>
                <Plus size={13} /> Nova Meta
              </CardActionBtn>
            </div>
            <p className="text-[11px] text-gray-500 font-mono mb-4 leading-relaxed">
              Configure mínimos aceitáveis para suas atividades. Não cumprir resulta em debuffs temporários.
            </p>
            {activityGoals && activityGoals.length > 0 ? (
              <div className="space-y-2.5">
                {activityGoals.map((goal) => {
                  const config = allConfigs[goal.category] || { name: goal.category, color: '#6366F1', icon: '📌' };
                  return (
                    <div
                      key={goal.id}
                      className={`flex items-center gap-3.5 p-3.5 bg-[#18181f] rounded-xl border border-white/[0.07] hover:border-accent/30 hover:bg-accent/[0.03] transition-all ${!goal.isActive ? 'opacity-50' : ''}`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        {config.icon && !['BookOpen', 'Dumbbell', 'Briefcase', 'Brain', 'Book'].includes(config.icon)
                          ? <span>{config.icon}</span>
                          : <Zap size={18} style={{ color: config.color }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-semibold mb-0.5">{config.name}</h4>
                        <p className="text-[11px] text-gray-500 font-mono truncate">
                          {goal.targetDuration} min/dia · {goal.targetSessions} dia(s)/semana
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <IconBtn onClick={() => handleToggleGoal(goal.id)} title={goal.isActive ? 'Desativar' : 'Ativar'}>
                          <span className="text-sm">{goal.isActive ? '⏸' : '▶'}</span>
                        </IconBtn>
                        <IconBtn onClick={() => handleEditGoal(goal)}>
                          <Edit3 size={12} />
                        </IconBtn>
                        <IconBtn onClick={() => handleDeleteGoal(goal.id)} danger>
                          <Trash2 size={12} />
                        </IconBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-[36px] mb-3 opacity-40">🎯</div>
                <h3 className="text-sm text-white/50 mb-1.5">Nenhuma meta configurada</h3>
                <p className="text-[12px] font-mono text-gray-600">Crie metas para manter sua consistência</p>
              </div>
            )}
          </div>

          <SectionDivider label="Categorias & Atividades" />

          {/* ── Categorias ── */}
          <div className={CARD}>
            <CardGlow color="rgba(78,205,196,0.3)" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <CardIcon emoji="🏷️" bg="rgba(78,205,196,0.15)" />
                <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Categorias</h2>
              </div>
              <CardActionBtn onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}>
                <Plus size={13} /> Nova
              </CardActionBtn>
            </div>

            <FieldLabel>Categorias padrão</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.values(ACTIVITY_CONFIGS).map((config) => (
                <span
                  key={config.category}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold tracking-[0.04em] border"
                  style={{ backgroundColor: `${config.color}20`, color: config.color, borderColor: `${config.color}33` }}
                >
                  {config.name}
                </span>
              ))}
            </div>

            {customCategories && customCategories.length > 0 ? (
              <>
                <FieldLabel>Customizadas</FieldLabel>
                <div className="space-y-2">
                  {customCategories.map((category) => (
                    <div
                      key={category.id}
                      className={`flex items-center gap-3.5 p-3.5 bg-[#18181f] rounded-xl border border-white/[0.07] hover:border-accent/30 transition-all ${!category.isActive ? 'opacity-50' : ''}`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        <ActivityIcon icon={category.icon} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-semibold mb-0.5">{category.name}</h4>
                        <p className="text-[11px] text-gray-500 font-mono">
                          {category.baseXP} XP · {category.xpPerMinute}/min · {category.goldPerSession} gold
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <IconBtn onClick={() => handleToggleCategory(category.id)}>
                          <span className="text-sm">{category.isActive ? '⏸' : '▶'}</span>
                        </IconBtn>
                        <IconBtn onClick={() => handleEditCategory(category)}>
                          <Edit3 size={12} />
                        </IconBtn>
                        <IconBtn onClick={() => handleDeleteCategory(category.id)} danger>
                          <Trash2 size={12} />
                        </IconBtn>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-[30px] mb-2 opacity-40">🏷️</div>
                <p className="text-xs font-mono text-gray-600">Nenhuma categoria customizada</p>
              </div>
            )}
          </div>

          {/* ── Notificações ── */}
          <div className={CARD}>
            <CardGlow color="rgba(255,107,107,0.3)" />
            <div className="flex items-center gap-2.5 mb-6">
              <CardIcon emoji="🔔" bg="rgba(255,107,107,0.15)" />
              <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Notificações</h2>
            </div>
            {[
              { color: '#7c6fff', title: 'Lembretes Diários',       desc: 'Receba lembretes para completar quests',      soon: true  },
              { color: '#4ecdc4', title: 'Debuff Alert',             desc: 'Aviso antes de perder streak',               soon: true  },
              { color: '#ffd93d', title: 'Level Up',                 desc: 'Notificação de conquistas e XP',             soon: false },
              { color: '#ff6b6b', title: 'Resumo Semanal',           desc: 'Relatório de desempenho toda segunda',       soon: true  },
              { color: '#2ecc71', title: 'Anki Revisão Pendente',    desc: 'Lembrete quando cards aguardam',             soon: true  },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3.5 border-b border-white/[0.07] last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <h4 className="text-[13px] font-semibold mb-0.5">{item.title}</h4>
                    <p className="text-[11px] text-gray-500 font-mono">{item.desc}</p>
                  </div>
                </div>
                {item.soon ? (
                  <SoonBadge />
                ) : (
                  <div className="w-11 h-6 bg-accent rounded-xl relative border border-accent shrink-0 shadow-[0_0_12px_rgba(124,111,255,0.4)]">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-[3px] translate-x-[25px]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <SectionDivider label="Integrações" />

          <AnkiSettingsSection />
          <CanvasSettingsSection />

          <SectionDivider label="Dados & Sistema" />

          {/* ── Gerenciamento de Dados ── */}
          <div className={`xl:col-span-2 ${CARD}`}>
            <CardGlow color="rgba(255,71,87,0.3)" />
            <div className="flex items-center gap-2.5 mb-6">
              <CardIcon emoji="💾" bg="rgba(255,71,87,0.15)" />
              <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Gerenciamento de Dados</h2>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Exportar */}
              <div className="flex items-center justify-between p-4 bg-[#18181f] rounded-xl border border-white/[0.07]">
                <div>
                  <h3 className="text-[13px] font-semibold mb-0.5">Exportar Dados</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Backup de todos os seus dados</p>
                </div>
                <DataBtn onClick={handleExport} variant="export">
                  <Download size={13} /> Exportar
                </DataBtn>
              </div>
              {/* Importar */}
              <div className="flex items-center justify-between p-4 bg-[#18181f] rounded-xl border border-white/[0.07]">
                <div>
                  <h3 className="text-[13px] font-semibold mb-0.5">Importar Dados</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Restaure de um backup</p>
                </div>
                <DataBtn onClick={handleImportClick} disabled={isImporting} variant="import">
                  <Upload size={13} /> {isImporting ? 'Importando...' : 'Importar'}
                </DataBtn>
              </div>
              {/* Relatório IA */}
              <div className="flex items-center justify-between p-4 bg-[#18181f] rounded-xl border border-white/[0.07]">
                <div>
                  <h3 className="text-[13px] font-semibold mb-0.5">Relatório + IA</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Últimos 7 dias com prompt de análise</p>
                </div>
                <DataBtn onClick={handleFullReportExport} variant="generate">
                  <FileText size={13} /> Gerar
                </DataBtn>
              </div>
              {/* Resetar Personagem */}
              <div className="flex items-center justify-between p-4 bg-[#18181f] rounded-xl border border-red-500/15 bg-red-500/[0.04]">
                <div>
                  <h3 className="text-[13px] font-semibold mb-0.5">Resetar Personagem</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Volta ao nível 1, mantém atividades e quests</p>
                </div>
                <DataBtn onClick={handleResetCharacter} variant="danger">
                  <User size={13} /> Resetar
                </DataBtn>
              </div>
              {/* Resetar Tudo */}
              <div className="sm:col-span-2 flex items-center justify-between p-4 bg-[#18181f] rounded-xl border border-red-500/15 bg-red-500/[0.04]">
                <div>
                  <h3 className="text-[13px] font-semibold mb-0.5 text-red-400">Resetar Tudo</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Apaga todos os dados permanentemente</p>
                </div>
                <DataBtn onClick={handleReset} variant="danger">
                  <Trash2 size={13} /> Deletar Tudo
                </DataBtn>
              </div>
            </div>
          </div>

          {/* ── About ── */}
          <div className={`xl:col-span-2 ${CARD}`}>
            <CardGlow />
            <div className="flex gap-4 items-start">
              <div className="w-14 h-14 bg-gradient-to-br from-accent to-[#a78bfa] rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-[0_0_24px_rgba(124,111,255,0.35)]">
                ⚡
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-[0.08em] mb-1">GRINDSET</h3>
                <p className="font-mono text-[11px] text-accent mb-2">v1.0.0 — Board gamificado para tracking de produtividade</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Transforme sua rotina em RPG. Complete quests, ganhe XP e evolua seu personagem enquanto constrói hábitos poderosos. Criado para quem leva o crescimento a sério.
                </p>
              </div>
            </div>
          </div>

        </div>{/* end main grid */}
      </div>

      {/* Modals */}
      <GoalModal
        isOpen={showGoalModal}
        onClose={() => { setShowGoalModal(false); setEditingGoal(null); }}
        editingGoal={editingGoal}
      />
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        editingCategory={editingCategory}
      />
    </div>
  );
}

// ============================================
// Anki Settings Section
// ============================================

function AnkiSettingsSection() {
  const [config, setConfigState] = useState(() => getAnkiConfig());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');

  const updateConfig = (updates: Record<string, unknown>) => {
    setAnkiConfig(updates);
    setConfigState(getAnkiConfig());
  };

  const updateAutoQuest = (updates: Record<string, unknown>) => {
    updateAutoQuestConfig(updates);
    setConfigState(getAnkiConfig());
  };

  const testConnection = async () => {
    setTestStatus('testing');
    const { ankiConnectService } = await import('@/services/ankiConnect');
    const connected = await ankiConnectService.checkConnection();
    setTestStatus(connected ? 'success' : 'fail');
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const clearCache = async () => {
    const { ankiRepository } = await import('@/database/repositories/ankiRepository');
    await ankiRepository.clearAllData();
    alert('Cache do Anki limpo com sucesso!');
  };

  const testLabel =
    testStatus === 'testing' ? 'Testando...' :
    testStatus === 'success' ? '✓ Conectado!' :
    testStatus === 'fail'    ? '✗ Falhou'     :
    '⚡ Testar Conexão';

  return (
    <div className={CARD}>
      <CardGlow color="rgba(46,204,113,0.3)" />
      <div className="flex items-center gap-2.5 mb-6">
        <CardIcon emoji="🃏" bg="rgba(46,204,113,0.15)" />
        <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Integração Anki</h2>
      </div>

      {/* Habilitar */}
      <div className="flex items-center justify-between py-3.5 border-b border-white/[0.07]">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Habilitar Anki</h3>
          <p className="text-[12px] text-gray-500 font-mono">Sincronizar com AnkiConnect (porta 8765)</p>
        </div>
        <ToggleSwitch value={config.enabled} onChange={() => updateConfig({ enabled: !config.enabled })} />
      </div>

      {/* Quest automática */}
      <div className="flex items-center justify-between py-3.5 border-b border-white/[0.07]">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Quest Automática</h3>
          <p className="text-[12px] text-gray-500 font-mono">Criar quest diária "Revisar Anki" automaticamente</p>
        </div>
        <ToggleSwitch value={config.autoQuest.enabled} onChange={() => updateAutoQuest({ enabled: !config.autoQuest.enabled })} />
      </div>

      {/* Threshold */}
      {config.autoQuest.enabled && (
        <div className="py-3.5 border-b border-white/[0.07]">
          <FieldLabel>Threshold de cards para completar quest</FieldLabel>
          <div className="flex items-center gap-3 mt-1">
            <div className="bg-[#18181f] border border-white/[0.07] rounded-xl px-4 py-2.5 font-mono text-xl font-medium text-accent min-w-[70px] text-center">
              {config.autoQuest.threshold}
            </div>
            <span className="text-xs text-gray-500 font-mono">cards/dia</span>
            <input
              type="range"
              min={1}
              max={100}
              value={config.autoQuest.threshold}
              onChange={(e) => updateAutoQuest({ threshold: Math.max(1, parseInt(e.target.value) || 1) })}
              className="flex-1 accent-accent"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={testConnection}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold border tracking-[0.04em] transition-all bg-accent/15 text-accent border-accent/30 hover:bg-accent hover:text-white hover:shadow-[0_4px_16px_rgba(124,111,255,0.4)]"
        >
          {testLabel}
        </button>
        <button
          type="button"
          onClick={clearCache}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold border tracking-[0.04em] transition-all bg-[#18181f] text-gray-300 border-white/[0.07] hover:border-accent hover:text-accent hover:bg-accent/[0.08]"
        >
          🗑 Limpar Cache
        </button>
      </div>
    </div>
  );
}

// ============================================
// Canvas Settings Section
// ============================================

function CanvasSettingsSection() {
  const [config, setConfigState] = useState(() => getCanvasConfig());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const updateConfig = (updates: Partial<ReturnType<typeof getCanvasConfig>>) => {
    setCanvasConfig(updates);
    setConfigState(getCanvasConfig());
  };

  const testConnection = async () => {
    setTestStatus('testing');
    const ok = await canvasService.checkConnection();
    setTestStatus(ok ? 'success' : 'fail');
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleSyncGrades = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await canvasService.syncGrades();
      const base = `${result.examsCreated} prova(s) nova(s), ${result.gradesUpdated} nota(s) atualizadas.`;
      const errMsg = result.errors.length > 0
        ? ` ⚠️ ${result.errors.length} matéria(s) com erro: ${result.errors.map(e => `${e.name} (${e.reason})`).join('; ')}`
        : '';
      setSyncResult(base + errMsg);
    } catch (err) {
      setSyncResult(`Erro: ${err instanceof Error ? err.message : 'Falha na sincronização'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const testLabel =
    testStatus === 'testing' ? 'Testando...' :
    testStatus === 'success' ? '✓ Conectado!' :
    testStatus === 'fail'    ? '✗ Falhou'     :
    '⚡ Testar';

  return (
    <>
      <div className={CARD}>
        <CardGlow color="rgba(78,205,196,0.3)" />
        <div className="flex items-center gap-2.5 mb-6">
          <CardIcon emoji="🎓" bg="rgba(78,205,196,0.15)" />
          <h2 className="text-[13px] font-bold tracking-[0.08em] uppercase">Integração Canvas</h2>
        </div>

        <div className="flex items-center justify-between py-3.5 border-b border-white/[0.07] mb-4">
          <div>
            <h3 className="text-sm font-semibold mb-0.5">Habilitar Canvas</h3>
            <p className="text-[12px] text-gray-500 font-mono">Sincronizar matérias e provas do Canvas LMS</p>
          </div>
          <ToggleSwitch value={config.enabled} onChange={() => updateConfig({ enabled: !config.enabled })} />
        </div>

        {config.enabled && (
          <>
            <div className="mb-4">
              <FieldLabel>URL da Instituição</FieldLabel>
              <input
                type="url"
                value={config.baseUrl}
                onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                placeholder="https://suauniversidade.instructure.com"
                className="w-full bg-[#18181f] border border-white/[0.07] rounded-xl text-gray-200 font-mono text-sm py-2.5 px-3.5 outline-none focus:border-accent/50 focus:bg-accent/[0.05] focus:shadow-[0_0_0_3px_rgba(124,111,255,0.1)] transition-all"
              />
              <p className="text-[11px] text-gray-600 font-mono mt-1.5">
                Configure também: <code className="text-accent">CANVAS_URL</code> no arquivo <code className="text-accent">.env.local</code>
              </p>
            </div>

            <div className="mb-4">
              <FieldLabel>Token de Acesso</FieldLabel>
              <input
                type="password"
                value={config.token}
                onChange={(e) => updateConfig({ token: e.target.value })}
                placeholder="Cole seu token pessoal do Canvas"
                className="w-full bg-[#18181f] border border-white/[0.07] rounded-xl text-gray-200 font-mono text-sm py-2.5 px-3.5 outline-none focus:border-accent/50 focus:bg-accent/[0.05] focus:shadow-[0_0_0_3px_rgba(124,111,255,0.1)] transition-all"
              />
              <p className="text-[11px] text-gray-600 font-mono mt-1.5">
                Canvas → Conta → Configurações → Tokens de Acesso → Gerar Token
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={testConnection}
                className="flex-1 min-w-[100px] text-center py-2.5 rounded-xl text-xs font-bold border tracking-[0.04em] transition-all bg-accent/15 text-accent border-accent/30 hover:bg-accent hover:text-white hover:shadow-[0_4px_16px_rgba(124,111,255,0.4)]"
              >
                {testLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex-1 min-w-[100px] text-center py-2.5 rounded-xl text-xs font-bold border tracking-[0.04em] transition-all bg-[#18181f] text-gray-300 border-white/[0.07] hover:border-accent hover:text-accent hover:bg-accent/[0.08]"
              >
                📚 Escolher Matérias
              </button>
              <button
                type="button"
                onClick={handleSyncGrades}
                disabled={isSyncing}
                className="flex-1 min-w-[100px] text-center py-2.5 rounded-xl text-xs font-bold border tracking-[0.04em] transition-all bg-[#18181f] text-gray-300 border-white/[0.07] hover:border-accent hover:text-accent hover:bg-accent/[0.08] disabled:opacity-50"
              >
                <RefreshCw size={11} className={`inline mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sync Notas'}
              </button>
            </div>

            {syncResult && (
              <p className="text-xs text-accent font-mono mt-3">{syncResult}</p>
            )}
          </>
        )}
      </div>

      <CanvasCourseSelectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={(msg) => { setSyncResult(msg); setTimeout(() => setSyncResult(null), 4000); }}
      />
    </>
  );
}

// ============================================
// Canvas Course Select Modal
// ============================================

function courseYear(c: CanvasCourse): string {
  if (c.term?.start_at) return String(new Date(c.term.start_at).getFullYear());
  if (c.term?.name) {
    const m = c.term.name.match(/\d{4}/);
    if (m) return m[0];
  }
  return 'Outros';
}

function CanvasCourseSelectModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: (msg: string) => void;
}) {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    Promise.all([
      canvasService.getAllCourses(),
      canvasService.getImportedCourseIds(),
    ]).then(([all, imported]) => {
      setCourses(all);
      setSelected(new Set(imported));
    }).catch(() => {
      setCourses([]);
    }).finally(() => setIsLoading(false));
  }, [isOpen]);

  const grouped = useMemo(() => {
    const seen = new Set<number>();
    const unique = courses.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    const map = new Map<string, CanvasCourse[]>();
    for (const c of unique) {
      const year = courseYear(c);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(c);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return Number(b) - Number(a);
    });
  }, [courses]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleYear = (_year: string, yearCourses: CanvasCourse[]) => {
    const allSelected = yearCourses.every(c => selected.has(c.id));
    setSelected(prev => {
      const next = new Set(prev);
      yearCourses.forEach(c => allSelected ? next.delete(c.id) : next.add(c.id));
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await canvasService.importCourses(Array.from(selected), courses);
      clearIgnoredCanvasCourseIds();
      const sync = await canvasService.syncGrades();
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} matéria(s) adicionada(s)`);
      if (sync.examsCreated > 0) parts.push(`${sync.examsCreated} prova(s)/trabalho(s) importado(s)`);
      if (sync.gradesUpdated > 0) parts.push(`${sync.gradesUpdated} nota(s) atualizada(s)`);
      onImported(parts.length > 0 ? parts.join(', ') + '.' : 'Nenhuma alteração.');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolher Matérias do Canvas" size="2xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Selecione as matérias para importar. Matérias já importadas não serão duplicadas. Para remover uma matéria, use o botão de exclusão na página Faculdade.
        </p>
        {isLoading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Carregando cursos do Canvas...</div>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">Nenhum curso encontrado. Verifique o token e a URL.</div>
        ) : (
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1 scrollbar-thin">
            {grouped.map(([year, yearCourses]) => {
              const allSelected = yearCourses.every(c => selected.has(c.id));
              const someSelected = yearCourses.some(c => selected.has(c.id));
              return (
                <div key={year}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-white">{year}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-gray-500">
                      {yearCourses.filter(c => selected.has(c.id)).length}/{yearCourses.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleYear(year, yearCourses)}
                      className="p-1 rounded hover:bg-bg-tertiary transition-colors"
                      title={allSelected ? 'Desmarcar todos de ' + year : 'Selecionar todos de ' + year}
                    >
                      {allSelected
                        ? <CheckSquare size={15} className="text-accent" />
                        : someSelected
                        ? <CheckSquare size={15} className="text-accent/40" />
                        : <Square size={15} className="text-gray-600" />
                      }
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {yearCourses.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggle(c.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          selected.has(c.id)
                            ? 'bg-accent/10 border-accent/30'
                            : 'bg-bg-tertiary/40 border-border/40 hover:border-border hover:bg-bg-tertiary'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate leading-snug">{c.name}</p>
                          <p className="text-xs text-gray-600 truncate">{c.course_code}</p>
                        </div>
                        {selected.has(c.id)
                          ? <CheckSquare size={15} className="text-accent shrink-0" />
                          : <Square size={15} className="text-gray-600 shrink-0" />
                        }
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 pt-1 border-t border-border">
          <Button className="flex-1" onClick={handleSave} isLoading={isSaving} disabled={isLoading || courses.length === 0}>
            <CheckSquare size={15} className="mr-1.5" />
            {isSaving ? 'Importando matérias e provas...' : `Importar (${selected.size} matérias)`}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Accent Color Picker
// ============================================

function AccentColorPicker() {
  const [selectedColor, setSelectedColor] = useState(getStoredAccentColor);

  const handleColorChange = (colorConfig: typeof ACCENT_COLORS[0]) => {
    setSelectedColor(colorConfig.color);
    setStoredAccentColor(colorConfig.color);
    applyAccentColor(colorConfig.color, colorConfig.secondary);
  };

  return (
    <div className="mb-5">
      <FieldLabel>Cor de destaque</FieldLabel>
      <div className="flex flex-wrap gap-2 mt-1">
        {ACCENT_COLORS.map((colorConfig) => (
          <button
            key={colorConfig.id}
            type="button"
            onClick={() => handleColorChange(colorConfig)}
            title={colorConfig.name}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              selectedColor === colorConfig.color
                ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: colorConfig.color }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Quest Colors Picker
// ============================================

function QuestColorsPicker() {
  const [colors, setColors] = useState<QuestCategoryColors>(getStoredQuestColors);
  const [editingCategory, setEditingCategory] = useState<keyof QuestCategoryColors | null>(null);

  const handleColorChange = (category: keyof QuestCategoryColors, color: string) => {
    const newColors = { ...colors, [category]: color };
    setColors(newColors);
    setStoredQuestColors(newColors);
    setEditingCategory(null);
  };

  const categoryLabels: Record<keyof QuestCategoryColors, string> = {
    daily: 'Daily Quest',
    main: 'Main Quest',
    side: 'Side Quest',
  };

  return (
    <div>
      <FieldLabel>Cores do Calendário</FieldLabel>
      <div className="grid grid-cols-3 gap-2 mt-1">
        {(Object.keys(categoryLabels) as Array<keyof QuestCategoryColors>).map((category) => (
          <div key={category}>
            <button
              type="button"
              onClick={() => setEditingCategory(editingCategory === category ? null : category)}
              className="flex items-center gap-2 px-3 py-2.5 bg-[#18181f] rounded-lg border border-white/[0.07] hover:border-white/[0.15] transition-all w-full"
            >
              <div className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: colors[category] }} />
              <span className="text-[11px] font-mono truncate">{categoryLabels[category]}</span>
            </button>
            {editingCategory === category && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 p-2 bg-[#18181f] rounded-lg border border-white/[0.07]">
                {QUEST_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleColorChange(category, option.color)}
                    title={option.name}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      colors[category] === option.color
                        ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                        : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: option.color }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Goal Modal
// ============================================

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGoal?: ActivityGoal | null;
}

function GoalModal({ isOpen, onClose, editingGoal }: GoalModalProps) {
  const [category, setCategory] = useState<ActivityCategory>('study');
  const [targetDuration, setTargetDuration] = useState(30);
  const [targetSessions, setTargetSessions] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [allConfigs, setAllConfigs] = useState(ACTIVITY_CONFIGS);

  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editingGoal) {
      setCategory(editingGoal.category);
      setTargetDuration(editingGoal.targetDuration);
      setTargetSessions(editingGoal.targetSessions);
    } else if (isOpen && !editingGoal) {
      setCategory('study');
      setTargetDuration(30);
      setTargetSessions(3);
    }
  }, [isOpen, editingGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingGoal) {
        await goalRepository.update(editingGoal.id, { category, targetDuration, targetSessions });
      } else {
        await goalRepository.create({ category, targetDuration, targetSessions });
      }
      handleClose();
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCategory('study');
    setTargetDuration(30);
    setTargetSessions(3);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingGoal ? 'Editar Meta' : 'Nova Meta'}
      subtitle="Tempo minimo (quests) e dias minimos (check-ins)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Atividade</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ActivityCategory)}
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
          >
            {Object.entries(allConfigs).map(([key, config]) => (
              <option key={key} value={key}>{config.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Min/dia (quests)</label>
            <input
              type="number"
              min="1"
              value={targetDuration}
              onChange={(e) => setTargetDuration(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dias/semana (check-ins)</label>
            <input
              type="number"
              min="1"
              value={targetSessions}
              onChange={(e) => setTargetSessions(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="p-4 bg-bg-tertiary rounded-xl border border-border">
          <p className="text-xs text-gray-400 mb-2">Resumo da Meta</p>
          <p className="text-white">
            <span className="font-medium">{allConfigs[category]?.name || category}</span>:{' '}
            <span className="text-accent font-medium">{targetDuration} min/dia</span> em quests +{' '}
            check-in em pelo menos{' '}
            <span className="text-accent font-medium">{targetSessions} dia(s)/semana</span>
          </p>
          <p className="text-xs text-red-400 mt-2">
            <AlertTriangle size={12} className="inline mr-1" />
            Nao cumprir resulta em -10% XP/Gold por 1 semana
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingGoal ? 'Salvar' : 'Criar Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Category Modal
// ============================================

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: CustomActivityCategory | null;
}

const COLOR_OPTIONS = ['#2e2ed1', '#6366F1', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6'];

function CategoryModal({ isOpen, onClose, editingCategory }: CategoryModalProps) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('BookOpen');
  const [color, setColor] = useState('#6366F1');
  const [baseXP, setBaseXP] = useState(15);
  const [xpPerMinute, setXpPerMinute] = useState(1.5);
  const [goldPerSession, setGoldPerSession] = useState(5);
  const [attributeImpacts, setAttributeImpacts] = useState<CustomAttributeImpact[]>([
    { attribute: 'knowledge', gainPerMinute: 0.08 },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && editingCategory) {
      setKey(editingCategory.key);
      setName(editingCategory.name);
      setIcon(editingCategory.icon);
      setColor(editingCategory.color);
      setBaseXP(editingCategory.baseXP);
      setXpPerMinute(editingCategory.xpPerMinute);
      setGoldPerSession(editingCategory.goldPerSession);
      if (editingCategory.attributeImpacts && editingCategory.attributeImpacts.length > 0) {
        setAttributeImpacts(editingCategory.attributeImpacts);
      } else if (editingCategory.primaryAttribute) {
        const impacts: CustomAttributeImpact[] = [{ attribute: editingCategory.primaryAttribute, gainPerMinute: 0.08 }];
        if (editingCategory.secondaryAttribute) impacts.push({ attribute: editingCategory.secondaryAttribute, gainPerMinute: 0.04 });
        setAttributeImpacts(impacts);
      }
    } else if (isOpen && !editingCategory) {
      setKey(''); setName(''); setIcon('BookOpen'); setColor('#6366F1');
      setBaseXP(15); setXpPerMinute(1.5); setGoldPerSession(5);
      setAttributeImpacts([{ attribute: 'knowledge', gainPerMinute: 0.08 }]);
    }
    setError('');
  }, [isOpen, editingCategory]);

  const handleAddAttribute = () => {
    const usedAttrs = attributeImpacts.map(a => a.attribute);
    const availableAttr = Object.keys(INITIAL_ATTRIBUTES).find(k => !usedAttrs.includes(k as AttributeType)) as AttributeType | undefined;
    if (availableAttr) setAttributeImpacts([...attributeImpacts, { attribute: availableAttr, gainPerMinute: 0.04 }]);
  };

  const handleRemoveAttribute = (index: number) => {
    if (attributeImpacts.length > 1) setAttributeImpacts(attributeImpacts.filter((_, i) => i !== index));
  };

  const handleUpdateAttribute = (index: number, field: 'attribute' | 'gainPerMinute', value: string | number) => {
    const updated = [...attributeImpacts];
    if (field === 'attribute') updated[index] = { ...updated[index], attribute: value as AttributeType };
    else updated[index] = { ...updated[index], gainPerMinute: value as number };
    setAttributeImpacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const categoryKey = key || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      if (editingCategory) {
        await categoryRepository.update(editingCategory.id, { key: categoryKey, name, icon, color, baseXP, xpPerMinute, goldPerSession, attributeImpacts });
      } else {
        await categoryRepository.create({ key: categoryKey, name, icon, color, baseXP, xpPerMinute, goldPerSession, attributeImpacts });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar categoria');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setKey(''); setName(''); setIcon('BookOpen'); setColor('#6366F1');
    setBaseXP(15); setXpPerMinute(1.5); setGoldPerSession(5);
    setAttributeImpacts([{ attribute: 'knowledge', gainPerMinute: 0.08 }]);
    setError('');
    onClose();
  };

  const attributeBonus = attributeImpacts.length >= 4 ? 1.3 : attributeImpacts.length >= 3 ? 1.2 : attributeImpacts.length >= 2 ? 1.1 : 1.0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      subtitle="Crie uma categoria personalizada para suas atividades"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Programação" required
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Key (opcional)</label>
            <input type="text" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="programacao"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
          <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto scrollbar-thin p-1">
            {ACTIVITY_ICON_NAMES.map((iconName) => (
              <button key={iconName} type="button" onClick={() => setIcon(iconName)} title={ACTIVITY_ICON_LABELS[iconName] || iconName}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${icon === iconName ? 'bg-accent/20 ring-2 ring-accent' : 'bg-bg-tertiary hover:bg-bg-hover'}`}
                style={{ color: icon === iconName ? color : undefined }}>
                <ActivityIcon icon={iconName} size={20} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button key={opt} type="button" onClick={() => setColor(opt)}
                className={`w-10 h-10 rounded-lg transition-all ${color === opt ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary' : ''}`}
                style={{ backgroundColor: opt }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">XP Base</label>
            <input type="number" min="1" value={baseXP} onChange={(e) => setBaseXP(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">XP/min</label>
            <input type="number" min="0.1" step="0.1" value={xpPerMinute} onChange={(e) => setXpPerMinute(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gold/sessão</label>
            <input type="number" min="1" value={goldPerSession} onChange={(e) => setGoldPerSession(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Atributos Impactados
              {attributeImpacts.length >= 2 && (
                <span className="ml-2 text-xs text-accent">(+{Math.round((attributeBonus - 1) * 100)}% bonus XP/Gold)</span>
              )}
            </label>
            {attributeImpacts.length < 7 && (
              <button type="button" onClick={handleAddAttribute}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors">
                <Plus size={14} /> Adicionar
              </button>
            )}
          </div>
          <div className="space-y-2">
            {attributeImpacts.map((impact, index) => {
              const attrInfo = INITIAL_ATTRIBUTES[impact.attribute];
              const usedAttrs = attributeImpacts.filter((_, i) => i !== index).map(a => a.attribute);
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: `${attrInfo?.color}20`, color: attrInfo?.color }}>
                    {index + 1}
                  </div>
                  <select value={impact.attribute} onChange={(e) => handleUpdateAttribute(index, 'attribute', e.target.value)}
                    className="flex-1 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent">
                    {Object.entries(INITIAL_ATTRIBUTES).map(([k, attr]) => (
                      <option key={k} value={k} disabled={usedAttrs.includes(k as AttributeType)}>{attr.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Ganho/min:</span>
                    <input type="number" min="0.01" step="0.01" value={impact.gainPerMinute}
                      onChange={(e) => handleUpdateAttribute(index, 'gainPerMinute', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-2 bg-bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent" />
                  </div>
                  {attributeImpacts.length > 1 && (
                    <button type="button" onClick={() => handleRemoveAttribute(index)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Mais atributos = mais bonus de XP e Gold nas atividades e quests relacionadas</p>
        </div>

        <div className="p-4 bg-bg-tertiary rounded-xl border border-border">
          <p className="text-xs text-gray-400 mb-3">Preview</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
              <ActivityIcon icon={icon} size={28} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{name || 'Nome da categoria'}</p>
              <p className="text-sm text-gray-400">{baseXP} XP + {xpPerMinute}/min · {goldPerSession} gold</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {attributeImpacts.map((impact, i) => {
                  const attrInfo = INITIAL_ATTRIBUTES[impact.attribute];
                  return (
                    <span key={i} className="px-2 py-0.5 text-[10px] font-bold rounded uppercase"
                      style={{ backgroundColor: `${attrInfo?.color}20`, color: attrInfo?.color }}>
                      +{impact.gainPerMinute}/min {attrInfo?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingCategory ? 'Salvar' : 'Criar Categoria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
