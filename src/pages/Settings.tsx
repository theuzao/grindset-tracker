import { useState, useEffect, useRef, useMemo } from 'react';
import type { ActivityConfig, CustomAttributeImpact } from '@/types';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  Database,
  Palette,
  Bell,
  Target,
  Plus,
  Edit3,
  Zap,
  AlertTriangle,
  Layers,
  X,
  User,
  FileText,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
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

  // Carregar todas as configs (padrão + customizadas)
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

      // Criar arquivo JSON com dados completos
      const jsonBlob = new Blob([JSON.stringify(report.rawData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `grindset-dados-completos-${date}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      // Criar arquivo de resumo e prompt de IA (Markdown)
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

      // Pequeno delay para garantir que o primeiro download comece
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Por favor, selecione um arquivo JSON válido');
      return;
    }

    const confirmImport = window.confirm(
      'Importar dados irá SUBSTITUIR os dados existentes com os mesmos IDs. Deseja continuar?'
    );

    if (!confirmImport) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validação básica da estrutura
      const validKeys = [
        'character', 'activities', 'quests', 'objectives', 'reflections',
        'weeklyReports', 'achievements', 'xpEvents', 'dailySnapshots',
        'aiInsights', 'activityGoals', 'goalProgress', 'debuffs', 'customCategories'
      ];

      const hasValidKeys = Object.keys(data).some(key => validKeys.includes(key));
      if (!hasValidKeys) {
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
        // Get current character to preserve name
        const character = await db.character.toCollection().first();
        if (!character) {
          alert('Personagem não encontrado');
          return;
        }

        // Reset character to initial values while preserving name
        const now = new Date().toISOString();
        const initialAttributes: Record<AttributeType, { type: AttributeType; name: string; icon: string; color: string; currentValue: number; baseValue: number }> = {} as any;

        for (const [key, attr] of Object.entries(INITIAL_ATTRIBUTES)) {
          initialAttributes[key as AttributeType] = {
            type: key as AttributeType,
            name: attr.name,
            icon: attr.icon,
            color: attr.color,
            currentValue: 0,
            baseValue: 0,
          };
        }

        await db.character.update(character.id, {
          level: 1,
          currentXP: 0,
          totalXP: 0,
          gold: 0,
          pendingPenalty: 0,
          title: 'Iniciante',
          attributes: initialAttributes,
          streak: {
            current: 0,
            longest: 0,
            lastActiveDate: now,
          },
          updatedAt: now,
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

  const handleEditGoal = (goal: ActivityGoal) => {
    setEditingGoal(goal);
    setShowGoalModal(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (window.confirm('Remover esta meta?')) {
      await goalRepository.delete(goalId);
    }
  };

  const handleToggleGoal = async (goalId: string) => {
    await goalRepository.toggleActive(goalId);
  };

  const handleEditCategory = (category: CustomActivityCategory) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Remover esta categoria?')) {
      await categoryRepository.delete(categoryId);
    }
  };

  const handleToggleCategory = async (categoryId: string) => {
    await categoryRepository.toggleActive(categoryId);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Configuracoes"
        subtitle="Personalize sua experiencia"
      />

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Active Debuffs Warning */}
        {activeDebuffs && activeDebuffs.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                Debuffs Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeDebuffs.map((debuff) => {
                  const remainingMs = new Date(debuff.expiresAt).getTime() - Date.now();
                  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={debuff.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                      <div>
                        <p className="font-medium text-red-400">{debuff.name}</p>
                        <p className="text-xs text-red-400/70">{debuff.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400">
                          -{Math.round((1 - debuff.multiplier) * 100)}%
                        </p>
                        <p className="text-xs text-red-400/70">
                          {remainingHours > 0 ? `${remainingHours}h ${remainingMinutes}m` : `${remainingMinutes}m`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Row 1: Goals + Appearance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* Activity Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={20} className="text-accent" />
              Metas de Atividade
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}>
              <Plus size={16} className="mr-1" />
              Nova Meta
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Configure minimos aceitaveis para suas atividades. Nao cumprir as metas resulta em debuffs temporarios.
            </p>

            {activityGoals && activityGoals.length > 0 ? (
              <div className="space-y-3">
                {activityGoals.map((goal) => {
                  const config = allConfigs[goal.category] || { name: goal.category, color: '#6366F1', icon: '📌' };
                  return (
                    <div
                      key={goal.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        goal.isActive
                          ? 'bg-bg-tertiary border-border'
                          : 'bg-bg-tertiary/50 border-border/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${config.color}20`, color: config.color }}
                        >
                          {config.icon && !['BookOpen', 'Dumbbell', 'Briefcase', 'Brain', 'Book'].includes(config.icon)
                            ? <span className="text-lg">{config.icon}</span>
                            : <Zap size={20} />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-white">{config.name}</p>
                          <p className="text-sm text-gray-400">
                            {goal.targetDuration} min/dia em quests, {goal.targetSessions} dia(s)/semana com check-in
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={goal.isActive ? 'accent' : 'default'}>
                          {goal.isActive ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <button
                          onClick={() => handleToggleGoal(goal.id)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white transition-colors"
                          title={goal.isActive ? 'Desativar' : 'Ativar'}
                        >
                          {goal.isActive ? '⏸' : '▶'}
                        </button>
                        <button
                          onClick={() => handleEditGoal(goal)}
                          className="p-2 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Target size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhuma meta configurada</p>
                <p className="text-sm">Crie metas para manter sua consistencia</p>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Appearance — col direita do Row 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={20} className="text-accent" />
                Aparência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div>
                  <p className="font-medium text-white">Tema</p>
                  <p className="text-sm text-gray-400">Dark (padrão)</p>
                </div>
                <span className="text-gray-500 text-sm">Em breve</span>
              </div>
              <AccentColorPicker />
              <QuestColorsPicker />
            </CardContent>
          </Card>
        </div>{/* fim Row 1 */}

        {/* Row 2: Categories + Data Management */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

          {/* Custom Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers size={20} className="text-accent" />
                Categorias de Atividade
              </CardTitle>
              <Button size="sm" onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}>
                <Plus size={16} className="mr-1" />
                Nova Categoria
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                Crie categorias personalizadas além das padrões (Estudo, Academia, etc).
              </p>
              <div className="mb-4 p-3 bg-bg-tertiary/50 rounded-lg border border-border/50">
                <p className="text-xs text-gray-500 mb-2">Categorias padrão:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(ACTIVITY_CONFIGS).map((config) => (
                    <span
                      key={config.category}
                      className="px-2 py-1 rounded-md text-xs font-medium"
                      style={{ backgroundColor: `${config.color}20`, color: config.color }}
                    >
                      {config.name}
                    </span>
                  ))}
                </div>
              </div>
              {customCategories && customCategories.length > 0 ? (
                <div className="space-y-3">
                  {customCategories.map((category) => (
                    <div
                      key={category.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        category.isActive ? 'bg-bg-tertiary border-border' : 'bg-bg-tertiary/50 border-border/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${category.color}20`, color: category.color }}
                        >
                          <ActivityIcon icon={category.icon} size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{category.name}</p>
                          <p className="text-xs text-gray-400">
                            {category.baseXP} XP · {category.xpPerMinute}/min · {category.goldPerSession} gold
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleToggleCategory(category.id)}
                          className="p-1.5 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white transition-colors">
                          {category.isActive ? '⏸' : '▶'}
                        </button>
                        <button onClick={() => handleEditCategory(category)}
                          className="p-1.5 rounded-lg hover:bg-bg-hover text-gray-400 hover:text-white transition-colors">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDeleteCategory(category.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Layers size={36} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhuma categoria customizada</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} className="text-accent" />
                Gerenciamento de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div>
                  <p className="font-medium text-white text-sm">Exportar Dados</p>
                  <p className="text-xs text-gray-400">Backup de todos os seus dados</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleExport}>
                  <Download size={14} className="mr-1.5" />
                  Exportar
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
                <div>
                  <p className="font-medium text-white text-sm">Relatório + IA</p>
                  <p className="text-xs text-gray-400">Últimos 7 dias com prompt de análise</p>
                </div>
                <Button variant="primary" size="sm" onClick={handleFullReportExport}>
                  <FileText size={14} className="mr-1.5" />
                  Gerar
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div>
                  <p className="font-medium text-white text-sm">Importar Dados</p>
                  <p className="text-xs text-gray-400">Restaure de um backup</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                <Button variant="secondary" size="sm" onClick={handleImportClick} isLoading={isImporting}>
                  <Upload size={14} className="mr-1.5" />
                  {isImporting ? 'Importando...' : 'Importar'}
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div>
                  <p className="font-medium text-amber-400 text-sm">Resetar Personagem</p>
                  <p className="text-xs text-amber-400/70">Volta ao nível 1, mantém atividades e quests</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleResetCharacter}>
                  <User size={14} className="mr-1.5" />
                  Resetar
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div>
                  <p className="font-medium text-red-400 text-sm">Resetar Tudo</p>
                  <p className="text-xs text-red-400/70">Apague todos os dados permanentemente</p>
                </div>
                <Button variant="danger" size="sm" onClick={handleReset}>
                  <Trash2 size={14} className="mr-1.5" />
                  Resetar
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>{/* fim Row 2 */}

        {/* Row 3: Anki + Canvas */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <AnkiSettingsSection />
          <CanvasSettingsSection />
        </div>{/* fim Row 3 */}

        {/* Row 4: Notifications + About */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} className="text-accent" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div>
                  <p className="font-medium text-white text-sm">Lembretes Diários</p>
                  <p className="text-xs text-gray-400">Receba lembretes para completar quests</p>
                </div>
                <span className="text-gray-500 text-sm">Em breve</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon size={20} className="text-accent" />
                Sobre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 py-2">
                <img src="/logo.png" alt="GRINDSET" className="w-14 h-14 rounded-xl shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-white">GRINDSET</h3>
                  <p className="text-gray-400 text-sm">v1.0.0</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Board gamificado para tracking de produtividade.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>{/* fim Row 4 */}

      </div>

      {/* Goal Modal */}
      <GoalModal
        isOpen={showGoalModal}
        onClose={() => { setShowGoalModal(false); setEditingGoal(null); }}
        editingGoal={editingGoal}
      />

      {/* Category Modal */}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers size={20} className="text-accent" />
          Integração Anki
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Toggle enabled */}
          <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
            <div>
              <p className="font-medium text-white">Habilitar Anki</p>
              <p className="text-sm text-gray-400">Sincronizar com AnkiConnect (porta 8765)</p>
            </div>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                config.enabled ? 'bg-accent' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Auto quest toggle */}
          <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
            <div>
              <p className="font-medium text-white">Quest Automática</p>
              <p className="text-sm text-gray-400">Criar quest diária "Revisar Anki" automaticamente</p>
            </div>
            <button
              onClick={() => updateAutoQuest({ enabled: !config.autoQuest.enabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                config.autoQuest.enabled ? 'bg-accent' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  config.autoQuest.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Threshold */}
          {config.autoQuest.enabled && (
            <div className="p-3 bg-bg-tertiary rounded-lg">
              <label className="text-sm text-gray-400 mb-2 block">
                Threshold de cards para completar quest
              </label>
              <input
                type="number"
                value={config.autoQuest.threshold}
                onChange={e => updateAutoQuest({ threshold: Math.max(1, parseInt(e.target.value) || 1) })}
                min={1}
                className="w-24 px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
              />
              <span className="text-sm text-gray-500 ml-2">cards/dia</span>
            </div>
          )}

          {/* Test connection */}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={testConnection}>
              {testStatus === 'testing' ? 'Testando...' :
               testStatus === 'success' ? 'Conectado!' :
               testStatus === 'fail' ? 'Falhou' :
               'Testar Conexão'}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCache}>
              Limpar Cache
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers size={20} className="text-accent" />
          Integração Canvas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
            <div>
              <p className="font-medium text-white">Habilitar Canvas</p>
              <p className="text-sm text-gray-400">Sincronizar matérias e provas do Canvas LMS</p>
            </div>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${config.enabled ? 'bg-accent' : 'bg-gray-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {config.enabled && (
            <>
              {/* URL */}
              <div className="p-3 bg-bg-tertiary rounded-lg space-y-2">
                <label className="text-sm text-gray-400">URL da Instituição</label>
                <input
                  type="url"
                  value={config.baseUrl}
                  onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                  placeholder="https://suauniversidade.instructure.com"
                  className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-gray-500">
                  Configure também: <code className="text-accent">CANVAS_URL</code> no arquivo <code className="text-accent">.env.local</code>
                </p>
              </div>

              {/* Token */}
              <div className="p-3 bg-bg-tertiary rounded-lg space-y-2">
                <label className="text-sm text-gray-400">Token de Acesso</label>
                <input
                  type="password"
                  value={config.token}
                  onChange={(e) => updateConfig({ token: e.target.value })}
                  placeholder="Cole seu token pessoal do Canvas"
                  className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-gray-500">
                  Canvas → Conta → Configurações → Tokens de Acesso → Gerar Token
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={testConnection}>
                  {testStatus === 'testing' ? 'Testando...' :
                   testStatus === 'success' ? 'Conectado!' :
                   testStatus === 'fail' ? 'Falhou' :
                   'Testar Conexão'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowImportModal(true)}>
                  Escolher Matérias
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSyncGrades} isLoading={isSyncing}>
                  <RefreshCw size={14} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync Notas
                </Button>
              </div>

              {syncResult && (
                <p className="text-sm text-accent">{syncResult}</p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>

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
  // Tenta extrair ano do term.start_at, depois term.name, depois 'Outros'
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

  // Deduplicar por id (Canvas retorna o mesmo curso várias vezes quando há múltiplas matrículas)
  // e agrupar por ano, mais recente primeiro
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

  const toggleYear = (year: string, yearCourses: CanvasCourse[]) => {
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
      onImported(result.added > 0 ? `${result.added} matéria(s) adicionada(s).` : 'Nenhuma matéria nova adicionada.');
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
                  {/* Year header — div, não button, para não competir com clicks dos cursos */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-white">{year}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-gray-500">
                      {yearCourses.filter(c => selected.has(c.id)).length}/{yearCourses.length}
                    </span>
                    {/* Botão de selecionar/desmarcar ano — área de clique pequena e explícita */}
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

                  {/* Cursos em grid 2 colunas */}
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
            Salvar seleção ({selected.size} matérias)
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGoal?: ActivityGoal | null;
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
    { attribute: 'knowledge', gainPerMinute: 0.08 }
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

      // Carregar attributeImpacts se existir, senão converter do formato legado
      if (editingCategory.attributeImpacts && editingCategory.attributeImpacts.length > 0) {
        setAttributeImpacts(editingCategory.attributeImpacts);
      } else if (editingCategory.primaryAttribute) {
        const impacts: CustomAttributeImpact[] = [
          { attribute: editingCategory.primaryAttribute, gainPerMinute: 0.08 }
        ];
        if (editingCategory.secondaryAttribute) {
          impacts.push({ attribute: editingCategory.secondaryAttribute, gainPerMinute: 0.04 });
        }
        setAttributeImpacts(impacts);
      }
    } else if (isOpen && !editingCategory) {
      setKey('');
      setName('');
      setIcon('BookOpen');
      setColor('#6366F1');
      setBaseXP(15);
      setXpPerMinute(1.5);
      setGoldPerSession(5);
      setAttributeImpacts([{ attribute: 'knowledge', gainPerMinute: 0.08 }]);
    }
    setError('');
  }, [isOpen, editingCategory]);

  const handleAddAttribute = () => {
    // Encontrar primeiro atributo não usado
    const usedAttrs = attributeImpacts.map(a => a.attribute);
    const availableAttr = Object.keys(INITIAL_ATTRIBUTES).find(
      k => !usedAttrs.includes(k as AttributeType)
    ) as AttributeType | undefined;

    if (availableAttr) {
      setAttributeImpacts([...attributeImpacts, { attribute: availableAttr, gainPerMinute: 0.04 }]);
    }
  };

  const handleRemoveAttribute = (index: number) => {
    if (attributeImpacts.length > 1) {
      setAttributeImpacts(attributeImpacts.filter((_, i) => i !== index));
    }
  };

  const handleUpdateAttribute = (index: number, field: 'attribute' | 'gainPerMinute', value: string | number) => {
    const updated = [...attributeImpacts];
    if (field === 'attribute') {
      updated[index] = { ...updated[index], attribute: value as AttributeType };
    } else {
      updated[index] = { ...updated[index], gainPerMinute: value as number };
    }
    setAttributeImpacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const categoryKey = key || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
      if (editingCategory) {
        await categoryRepository.update(editingCategory.id, {
          key: categoryKey,
          name,
          icon,
          color,
          baseXP,
          xpPerMinute,
          goldPerSession,
          attributeImpacts,
        });
      } else {
        await categoryRepository.create({
          key: categoryKey,
          name,
          icon,
          color,
          baseXP,
          xpPerMinute,
          goldPerSession,
          attributeImpacts,
        });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar categoria');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setKey('');
    setName('');
    setIcon('BookOpen');
    setColor('#6366F1');
    setBaseXP(15);
    setXpPerMinute(1.5);
    setGoldPerSession(5);
    setAttributeImpacts([{ attribute: 'knowledge', gainPerMinute: 0.08 }]);
    setError('');
    onClose();
  };

  // Calcular bonus de atributos para preview
  const attributeBonus = attributeImpacts.length >= 4 ? 1.3 :
                         attributeImpacts.length >= 3 ? 1.2 :
                         attributeImpacts.length >= 2 ? 1.1 : 1.0;

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
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Programação"
              required
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Key (opcional)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="programacao"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
          <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto scrollbar-thin p-1">
            {ACTIVITY_ICON_NAMES.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                title={ACTIVITY_ICON_LABELS[iconName] || iconName}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  icon === iconName
                    ? 'bg-accent/20 ring-2 ring-accent'
                    : 'bg-bg-tertiary hover:bg-bg-hover'
                }`}
                style={{ color: icon === iconName ? color : undefined }}
              >
                <ActivityIcon icon={iconName} size={20} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setColor(opt)}
                className={`w-10 h-10 rounded-lg transition-all ${
                  color === opt ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary' : ''
                }`}
                style={{ backgroundColor: opt }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">XP Base</label>
            <input
              type="number"
              min="1"
              value={baseXP}
              onChange={(e) => setBaseXP(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">XP/min</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={xpPerMinute}
              onChange={(e) => setXpPerMinute(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gold/sessão</label>
            <input
              type="number"
              min="1"
              value={goldPerSession}
              onChange={(e) => setGoldPerSession(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Attribute Impacts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Atributos Impactados
              {attributeImpacts.length >= 2 && (
                <span className="ml-2 text-xs text-accent">
                  (+{Math.round((attributeBonus - 1) * 100)}% bonus XP/Gold)
                </span>
              )}
            </label>
            {attributeImpacts.length < 7 && (
              <button
                type="button"
                onClick={handleAddAttribute}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
              >
                <Plus size={14} />
                Adicionar
              </button>
            )}
          </div>

          <div className="space-y-2">
            {attributeImpacts.map((impact, index) => {
              const attrInfo = INITIAL_ATTRIBUTES[impact.attribute];
              const usedAttrs = attributeImpacts.filter((_, i) => i !== index).map(a => a.attribute);

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg border border-border"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: `${attrInfo?.color}20`, color: attrInfo?.color }}
                  >
                    {index + 1}
                  </div>

                  <select
                    value={impact.attribute}
                    onChange={(e) => handleUpdateAttribute(index, 'attribute', e.target.value)}
                    className="flex-1 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                  >
                    {Object.entries(INITIAL_ATTRIBUTES).map(([key, attr]) => (
                      <option
                        key={key}
                        value={key}
                        disabled={usedAttrs.includes(key as AttributeType)}
                      >
                        {attr.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Ganho/min:</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={impact.gainPerMinute}
                      onChange={(e) => handleUpdateAttribute(index, 'gainPerMinute', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-2 bg-bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                    />
                  </div>

                  {attributeImpacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(index)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Mais atributos = mais bonus de XP e Gold nas atividades e quests relacionadas
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 bg-bg-tertiary rounded-xl border border-border">
          <p className="text-xs text-gray-400 mb-3">Preview</p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}20`, color: color }}
            >
              <ActivityIcon icon={icon} size={28} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{name || 'Nome da categoria'}</p>
              <p className="text-sm text-gray-400">
                {baseXP} XP + {xpPerMinute}/min · {goldPerSession} gold
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {attributeImpacts.map((impact, i) => {
                  const attrInfo = INITIAL_ATTRIBUTES[impact.attribute];
                  return (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-[10px] font-bold rounded uppercase"
                      style={{ backgroundColor: `${attrInfo?.color}20`, color: attrInfo?.color }}
                    >
                      +{impact.gainPerMinute}/min {attrInfo?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingCategory ? 'Salvar' : 'Criar Categoria'}
          </Button>
        </div>
      </form>
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

  const currentColorConfig = ACCENT_COLORS.find(c => c.color === selectedColor) || ACCENT_COLORS[0];

  return (
    <div className="p-4 bg-bg-tertiary rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-medium text-white">Cor de Destaque</p>
          <p className="text-sm text-gray-400">{currentColorConfig.name}</p>
        </div>
        <div
          className="w-8 h-8 rounded-full ring-2 ring-white/20"
          style={{ backgroundColor: selectedColor }}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {ACCENT_COLORS.map((colorConfig) => (
          <button
            key={colorConfig.id}
            onClick={() => handleColorChange(colorConfig)}
            title={colorConfig.name}
            className={`w-10 h-10 rounded-full transition-all ${
              selectedColor === colorConfig.color
                ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-tertiary scale-110'
                : 'hover:scale-105'
            }`}
            style={{ backgroundColor: colorConfig.color }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Quest Colors Picker (Calendar Legend)
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
    <div className="p-4 bg-bg-tertiary rounded-lg">
      <div className="mb-4">
        <p className="font-medium text-white">Cores do Calendario</p>
        <p className="text-sm text-gray-400">Personalize as cores da legenda</p>
      </div>
      <div className="space-y-3">
        {(Object.keys(categoryLabels) as Array<keyof QuestCategoryColors>).map((category) => (
          <div key={category} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-5 rounded"
                style={{ backgroundColor: colors[category] }}
              />
              <span className="text-sm text-gray-300">{categoryLabels[category]}</span>
            </div>
            {editingCategory === category ? (
              <div className="flex flex-wrap gap-2 max-w-[200px]">
                {QUEST_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleColorChange(category, option.color)}
                    title={option.name}
                    className={`w-6 h-6 rounded-full transition-all ${
                      colors[category] === option.color
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-bg-tertiary scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: option.color }}
                  />
                ))}
              </div>
            ) : (
              <button
                onClick={() => setEditingCategory(category)}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Alterar
              </button>
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

function GoalModal({ isOpen, onClose, editingGoal }: GoalModalProps) {
  const [category, setCategory] = useState<ActivityCategory>('study');
  const [targetDuration, setTargetDuration] = useState(30);
  const [targetSessions, setTargetSessions] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [allConfigs, setAllConfigs] = useState(ACTIVITY_CONFIGS);

  // Carregar todas as configs (padrão + customizadas)
  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [isOpen]);

  // Preencher form quando editando
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
        await goalRepository.update(editingGoal.id, {
          category,
          targetDuration,
          targetSessions,
        });
      } else {
        await goalRepository.create({
          category,
          targetDuration,
          targetSessions,
        });
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Min/dia (quests)
            </label>
            <input
              type="number"
              min="1"
              value={targetDuration}
              onChange={(e) => setTargetDuration(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dias/semana (check-ins)
            </label>
            <input
              type="number"
              min="1"
              value={targetSessions}
              onChange={(e) => setTargetSessions(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Preview */}
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
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingGoal ? 'Salvar' : 'Criar Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
