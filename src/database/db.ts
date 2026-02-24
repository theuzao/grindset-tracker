import Dexie, { type Table } from 'dexie';
import type {
  Character,
  ActivityLog,
  Quest,
  Objective,
  Reflection,
  WeeklyReport,
  Achievement,
  XPEvent,
  DailySnapshot,
  AIInsight,
  ActivityGoal,
  GoalProgress,
  Debuff,
  CustomActivityCategory,
  CheckIn,
  CheckInStreak,
  Subject,
  SubjectTopic,
  SubjectExam,
} from '@/types';
import type { AnkiDeck, AnkiReview, AnkiSnapshot } from '@/features/anki/types';

// Helper para obter data local no formato YYYY-MM-DD (evita problemas de timezone com toISOString)
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class LifeQuestDatabase extends Dexie {
  character!: Table<Character>;
  activities!: Table<ActivityLog>;
  quests!: Table<Quest>;
  objectives!: Table<Objective>;
  reflections!: Table<Reflection>;
  weeklyReports!: Table<WeeklyReport>;
  achievements!: Table<Achievement>;
  xpEvents!: Table<XPEvent>;
  dailySnapshots!: Table<DailySnapshot>;
  aiInsights!: Table<AIInsight>;
  activityGoals!: Table<ActivityGoal>;
  goalProgress!: Table<GoalProgress>;
  debuffs!: Table<Debuff>;
  customCategories!: Table<CustomActivityCategory>;
  checkIns!: Table<CheckIn>;
  checkInStreaks!: Table<CheckInStreak>;
  ankiDecks!: Table<AnkiDeck>;
  ankiReviews!: Table<AnkiReview>;
  ankiSnapshots!: Table<AnkiSnapshot>;
  subjects!: Table<Subject>;
  subjectTopics!: Table<SubjectTopic>;
  subjectExams!: Table<SubjectExam>;

  constructor() {
    super('LifeQuestDB');

    this.version(1).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
    });

    // Versão 2: adiciona sistema de metas e debuffs
    this.version(2).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
      activityGoals: 'id, category, recurrence, isActive, [category+recurrence]',
      goalProgress: 'goalId, date, [goalId+date]',
      debuffs: 'id, type, isActive, expiresAt',
    });

    // Versão 3: adiciona categorias customizáveis
    this.version(3).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
      activityGoals: 'id, category, recurrence, isActive, [category+recurrence]',
      goalProgress: 'goalId, date, [goalId+date]',
      debuffs: 'id, type, isActive, expiresAt',
      customCategories: 'id, key, isActive',
    });

    // Versão 4: adiciona sistema de check-ins diários (hábitos)
    this.version(4).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
      activityGoals: 'id, category, recurrence, isActive, [category+recurrence]',
      goalProgress: 'goalId, date, [goalId+date]',
      debuffs: 'id, type, isActive, expiresAt',
      customCategories: 'id, key, isActive',
      checkIns: 'id, category, date, [category+date]',
      checkInStreaks: 'category',
    });

    // Versão 5: integração Anki
    this.version(5).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
      activityGoals: 'id, category, recurrence, isActive, [category+recurrence]',
      goalProgress: 'goalId, date, [goalId+date]',
      debuffs: 'id, type, isActive, expiresAt',
      customCategories: 'id, key, isActive',
      checkIns: 'id, category, date, [category+date]',
      checkInStreaks: 'category',
      ankiDecks: 'name, lastSynced',
      ankiReviews: 'id, deckName, date, source, [deckName+date]',
      ankiSnapshots: 'id, date',
    });

    // Versão 6: módulo Faculdade (matérias, tópicos, provas)
    this.version(6).stores({
      character: 'id',
      activities: 'id, category, completedAt, [category+completedAt]',
      quests: 'id, status, scheduledDate, category, [status+scheduledDate]',
      objectives: 'id, status, timeframe, targetDate, [status+timeframe]',
      reflections: 'id, type, date, *tags',
      weeklyReports: 'id, weekStart, weekEnd',
      achievements: 'id, code, category, isUnlocked',
      xpEvents: 'id, source, timestamp',
      dailySnapshots: 'id, date',
      aiInsights: 'id, type, createdAt, isRead',
      activityGoals: 'id, category, recurrence, isActive, [category+recurrence]',
      goalProgress: 'goalId, date, [goalId+date]',
      debuffs: 'id, type, isActive, expiresAt',
      customCategories: 'id, key, isActive',
      checkIns: 'id, category, date, [category+date]',
      checkInStreaks: 'category',
      ankiDecks: 'name, lastSynced',
      ankiReviews: 'id, deckName, date, source, [deckName+date]',
      ankiSnapshots: 'id, date',
      subjects: 'id, semester, isActive, canvasId',
      subjectTopics: 'id, subjectId, [subjectId+isDone]',
      subjectExams: 'id, subjectId, scheduledDate, canvasId',
    });
  }
}

export const db = new LifeQuestDatabase();

// Cleanup: remover xpEvents duplicados de "Afirmações" a partir das 9am de 07/02/2026
// e corrigir XP/Gold do personagem. Roda apenas uma vez.
async function runOneTimeCleanup() {
  const CLEANUP_KEY = 'cleanup_afirmacoes_20260207';
  if (localStorage.getItem(CLEANUP_KEY)) return;

  try {
    // Buscar todos xpEvents de hoje com "Afirmações" no description
    const today9am = new Date();
    today9am.setHours(9, 0, 0, 0);
    const cutoffISO = today9am.toISOString();

    const allXpEvents = await db.xpEvents.toArray();
    const badEvents = allXpEvents.filter(
      (e) =>
        e.description.includes('Afirmações') &&
        e.timestamp >= cutoffISO
    );

    if (badEvents.length === 0) {
      localStorage.setItem(CLEANUP_KEY, 'done');
      return;
    }

    // Calcular XP total a reverter
    const totalXPToRevert = badEvents.reduce((sum, e) => sum + e.amount, 0);

    // Deletar os eventos ruins
    const badIds = badEvents.map((e) => e.id);
    await db.xpEvents.bulkDelete(badIds);

    // Corrigir XP do personagem
    if (totalXPToRevert !== 0) {
      const character = await db.character.toCollection().first();
      if (character) {
        const { getLevelFromTotalXP, getTitleForLevel } = await import('@/features/gamification/constants');
        const newTotalXP = Math.max(0, character.totalXP - totalXPToRevert);
        const newCurrentXP = Math.max(0, character.currentXP - totalXPToRevert);
        const newLevel = getLevelFromTotalXP(newTotalXP);
        const newTitle = getTitleForLevel(newLevel);

        await db.character.update(character.id, {
          totalXP: newTotalXP,
          currentXP: newCurrentXP,
          level: newLevel,
          title: newTitle,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    console.log(`[Cleanup] Removidos ${badEvents.length} xpEvents duplicados de Afirmações. XP revertido: ${totalXPToRevert}`);
    localStorage.setItem(CLEANUP_KEY, 'done');
  } catch (error) {
    console.error('[Cleanup] Erro ao limpar dados:', error);
  }
}

// Remove xpEvents negativos (penalidades antigas) — roda uma vez
async function removeNegativeXPEvents() {
  const KEY = 'remove_negative_xp_events_20260223';
  if (localStorage.getItem(KEY)) return;
  try {
    const negativeEvents = await db.xpEvents.filter(e => e.amount < 0).toArray();
    if (negativeEvents.length > 0) {
      await db.xpEvents.bulkDelete(negativeEvents.map(e => e.id));
      console.log(`[Cleanup] Removidos ${negativeEvents.length} xpEvents negativos (penalidades antigas)`);
    }
    localStorage.setItem(KEY, 'done');
  } catch (error) {
    console.error('[Cleanup] Erro ao remover xpEvents negativos:', error);
  }
}

// Remove xpEvents de check-in órfãos: positivos cujo check-in foi desfeito (sourceId não existe mais)
async function removeOrphanedCheckInXPEvents() {
  const KEY = 'cleanup_orphaned_checkin_xpevents_20260223';
  if (localStorage.getItem(KEY)) return;
  try {
    const checkInEvents = await db.xpEvents
      .filter(e => e.source === 'check-in' && e.amount > 0 && !!e.sourceId)
      .toArray();
    const orphanIds: string[] = [];
    for (const event of checkInEvents) {
      const checkIn = await db.checkIns.get(event.sourceId!);
      if (!checkIn) orphanIds.push(event.id);
    }
    if (orphanIds.length > 0) {
      await db.xpEvents.bulkDelete(orphanIds);
      console.log(`[Cleanup] Removidos ${orphanIds.length} xpEvents de check-in órfãos`);
    }
    localStorage.setItem(KEY, 'done');
  } catch (error) {
    console.error('[Cleanup] Erro ao remover xpEvents órfãos:', error);
  }
}

// Executar cleanup ao carregar
db.on('ready', () => {
  runOneTimeCleanup();
  removeNegativeXPEvents();
  removeOrphanedCheckInXPEvents();
});

// Auto-fail de quests atrasadas (roda após o DB estar pronto, fora do on-ready)
async function runAutoFail() {
  try {
    const { questRepository } = await import('./repositories/questRepository');
    const failed = await questRepository.failOverdueQuests();
    if (failed > 0) {
      console.log(`[Auto-fail] ${failed} quest(s) atrasada(s) marcada(s) como não realizada(s)`);
    }
  } catch (error) {
    console.error('[Auto-fail] Erro:', error);
  }
}

db.open().then(() => {
  runAutoFail();
});

// Função para resetar o banco (desenvolvimento)
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}

// Função para exportar todos os dados
export async function exportAllData(): Promise<object> {
  return {
    character: await db.character.toArray(),
    activities: await db.activities.toArray(),
    quests: await db.quests.toArray(),
    objectives: await db.objectives.toArray(),
    reflections: await db.reflections.toArray(),
    weeklyReports: await db.weeklyReports.toArray(),
    achievements: await db.achievements.toArray(),
    xpEvents: await db.xpEvents.toArray(),
    dailySnapshots: await db.dailySnapshots.toArray(),
    aiInsights: await db.aiInsights.toArray(),
    activityGoals: await db.activityGoals.toArray(),
    goalProgress: await db.goalProgress.toArray(),
    debuffs: await db.debuffs.toArray(),
    customCategories: await db.customCategories.toArray(),
    checkIns: await db.checkIns.toArray(),
    checkInStreaks: await db.checkInStreaks.toArray(),
    ankiDecks: await db.ankiDecks.toArray(),
    ankiReviews: await db.ankiReviews.toArray(),
    ankiSnapshots: await db.ankiSnapshots.toArray(),
    subjects: await db.subjects.toArray(),
    subjectTopics: await db.subjectTopics.toArray(),
    subjectExams: await db.subjectExams.toArray(),
  };
}

// Função para exportar relatório completo com análise de IA
export async function exportFullReport(): Promise<{
  rawData: object;
  last7Days: object;
  summary: object;
  aiAnalysisPrompt: string;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  // Dados brutos
  const character = await db.character.toCollection().first();
  const allQuests = await db.quests.toArray();
  const allObjectives = await db.objectives.toArray();
  const allReflections = await db.reflections.toArray();
  const allCheckIns = await db.checkIns.toArray();
  const allCheckInStreaks = await db.checkInStreaks.toArray();
  const allXPEvents = await db.xpEvents.toArray();
  const allAchievements = await db.achievements.toArray();
  const allActivityGoals = await db.activityGoals.toArray();
  const customCategories = await db.customCategories.toArray();

  // Filtrar últimos 7 dias
  const last7DaysQuests = allQuests.filter(q => q.scheduledDate >= sevenDaysAgoStr || q.completedAt && q.completedAt >= sevenDaysAgoStr);
  const last7DaysReflections = allReflections.filter(r => r.date >= sevenDaysAgoStr);
  const last7DaysCheckIns = allCheckIns.filter(c => c.date >= sevenDaysAgo.toISOString().split('T')[0]);
  const last7DaysXPEvents = allXPEvents.filter(e => e.timestamp >= sevenDaysAgoStr);

  // Calcular estatísticas dos últimos 7 dias
  const completedQuestsLast7Days = last7DaysQuests.filter(q => q.status === 'completed');
  const failedQuestsLast7Days = last7DaysQuests.filter(q => q.status === 'failed');
  const pendingQuestsLast7Days = last7DaysQuests.filter(q => q.status === 'pending');

  const xpGainedLast7Days = last7DaysXPEvents.reduce((sum, e) => sum + e.amount, 0);

  // Frequência de check-ins por categoria
  const checkInFrequency: Record<string, number> = {};
  last7DaysCheckIns.forEach(c => {
    checkInFrequency[c.category] = (checkInFrequency[c.category] || 0) + 1;
  });

  // Dias com atividade nos últimos 7 dias
  const activeDays = new Set(last7DaysCheckIns.map(c => c.date)).size;

  // Tempo estimado por atividade relacionada (quests completadas)
  const timeByActivity: Record<string, { totalMinutes: number; questCount: number }> = {};
  completedQuestsLast7Days.forEach(q => {
    if (q.estimatedDuration && q.relatedActivity) {
      if (!timeByActivity[q.relatedActivity]) {
        timeByActivity[q.relatedActivity] = { totalMinutes: 0, questCount: 0 };
      }
      timeByActivity[q.relatedActivity].totalMinutes += q.estimatedDuration;
      timeByActivity[q.relatedActivity].questCount += 1;
    }
  });

  // Total de tempo estimado em quests completadas
  const totalEstimatedMinutes = completedQuestsLast7Days.reduce((sum, q) => sum + (q.estimatedDuration || 0), 0);

  // Objetivos ativos e seu progresso
  const activeObjectives = allObjectives.filter(o => o.status === 'active');

  // Conquistas desbloqueadas
  const unlockedAchievements = allAchievements.filter(a => a.isUnlocked);

  // Metas de atividade
  const activeGoals = allActivityGoals.filter(g => g.isActive);

  // Resumo
  const summary = {
    periodo: {
      inicio: sevenDaysAgo.toISOString().split('T')[0],
      fim: now.toISOString().split('T')[0],
    },
    personagem: character ? {
      nome: character.name,
      nivel: character.level,
      titulo: character.title,
      xpTotal: character.totalXP,
      gold: character.gold,
      streakAtual: character.streak.current,
      maiorStreak: character.streak.longest,
      atributos: Object.entries(character.attributes).map(([_, attr]) => ({
        nome: attr.name,
        valor: attr.currentValue,
      })),
    } : null,
    ultimos7Dias: {
      xpGanho: xpGainedLast7Days,
      diasAtivos: activeDays,
      questsCompletadas: completedQuestsLast7Days.length,
      questsFalhadas: failedQuestsLast7Days.length,
      questsPendentes: pendingQuestsLast7Days.length,
      taxaConclusaoQuests: last7DaysQuests.length > 0
        ? Math.round((completedQuestsLast7Days.length / last7DaysQuests.length) * 100)
        : 0,
      checkInsPorCategoria: checkInFrequency,
      totalCheckIns: last7DaysCheckIns.length,
      reflexoesEscritas: last7DaysReflections.length,
      tempoEstimadoTotal: totalEstimatedMinutes,
      tempoPorAtividade: Object.entries(timeByActivity).map(([activity, data]) => ({
        atividade: activity,
        minutosTotais: data.totalMinutes,
        questsCompletadas: data.questCount,
        mediaMinutosPorQuest: Math.round(data.totalMinutes / data.questCount),
      })),
    },
    objetivosAtivos: activeObjectives.map(o => ({
      titulo: o.title,
      descricao: o.description,
      progresso: o.progress,
      prazo: o.targetDate,
      milestones: o.milestones.map(m => ({
        titulo: m.title,
        completo: m.isCompleted,
      })),
    })),
    metasDeAtividade: activeGoals.map(g => ({
      categoria: g.category,
      recorrencia: g.recurrence,
      duracaoAlvo: g.targetDuration,
      sessoesAlvo: g.targetSessions,
    })),
    conquistasDesbloqueadas: unlockedAchievements.length,
    totalConquistas: allAchievements.length,
    streaksPorCategoria: allCheckInStreaks.map(s => ({
      categoria: s.category,
      streakAtual: s.currentStreak,
      maiorStreak: s.longestStreak,
      totalCheckIns: s.totalCheckIns,
    })),
  };

  // Gerar prompt para análise de IA
  const aiAnalysisPrompt = `# Análise de Progresso Pessoal - GRINDSET Tracker

## Contexto
Você é um coach de produtividade e desenvolvimento pessoal analisando os dados de um usuário do GRINDSET, um app gamificado de rastreamento de hábitos e produtividade.

## Dados do Usuário

### Perfil
- Nome: ${character?.name || 'N/A'}
- Nível: ${character?.level || 1}
- Título: ${character?.title || 'Iniciante'}
- XP Total: ${character?.totalXP || 0}
- Gold: ${character?.gold || 0}
- Streak Atual: ${character?.streak.current || 0} dias
- Maior Streak: ${character?.streak.longest || 0} dias

### Atributos (0-100)
${character ? Object.entries(character.attributes).map(([_, attr]) => `- ${attr.name}: ${attr.currentValue.toFixed(1)}`).join('\n') : 'N/A'}

### Últimos 7 Dias (${summary.periodo.inicio} a ${summary.periodo.fim})
- XP Ganho: ${xpGainedLast7Days}
- Dias Ativos: ${activeDays}/7
- Quests Completadas: ${completedQuestsLast7Days.length}
- Quests Falhadas: ${failedQuestsLast7Days.length}
- Quests Pendentes: ${pendingQuestsLast7Days.length}
- Taxa de Conclusão: ${summary.ultimos7Dias.taxaConclusaoQuests}%
- Total de Check-ins: ${last7DaysCheckIns.length}
- Reflexões Escritas: ${last7DaysReflections.length}

### Frequência de Check-ins por Categoria (últimos 7 dias)
${Object.entries(checkInFrequency).map(([cat, count]) => `- ${cat}: ${count} vezes`).join('\n') || 'Nenhum check-in registrado'}

### Tempo Investido por Atividade (baseado em quests completadas)
- Tempo Total Estimado: ${totalEstimatedMinutes >= 60 ? `${Math.floor(totalEstimatedMinutes / 60)}h ${totalEstimatedMinutes % 60}min` : `${totalEstimatedMinutes} minutos`}
${Object.entries(timeByActivity).length > 0 ? Object.entries(timeByActivity).map(([activity, data]) => `- ${activity}: ${data.totalMinutes >= 60 ? `${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60}min` : `${data.totalMinutes}min`} (${data.questCount} quests)`).join('\n') : 'Nenhuma quest com tempo registrado'}

### Objetivos Ativos
${activeObjectives.length > 0 ? activeObjectives.map(o => `- ${o.title} (${o.progress}% completo, prazo: ${o.targetDate.split('T')[0]})
  ${o.description || 'Sem descrição'}
  Milestones: ${o.milestones.filter(m => m.isCompleted).length}/${o.milestones.length} completos`).join('\n\n') : 'Nenhum objetivo ativo'}

### Metas de Atividade
${activeGoals.length > 0 ? activeGoals.map(g => `- ${g.category}: ${g.targetDuration}min/semana, ${g.targetSessions} sessões`).join('\n') : 'Nenhuma meta definida'}

### Streaks por Categoria
${allCheckInStreaks.length > 0 ? allCheckInStreaks.map(s => `- ${s.category}: ${s.currentStreak} dias (recorde: ${s.longestStreak})`).join('\n') : 'Nenhum streak registrado'}

### Conquistas
- Desbloqueadas: ${unlockedAchievements.length}/${allAchievements.length}

### Quests dos Últimos 7 Dias
${last7DaysQuests.slice(0, 20).map(q => `- [${q.status === 'completed' ? '✓' : q.status === 'failed' ? '✗' : '○'}] ${q.title} (${q.difficulty}${q.relatedActivity ? `, ${q.relatedActivity}` : ''}${q.estimatedDuration ? `, ${q.estimatedDuration}min` : ''})`).join('\n') || 'Nenhuma quest'}

### Reflexões Recentes
${last7DaysReflections.slice(0, 5).map(r => `- [${r.type}] ${r.title || 'Sem título'}: "${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}"`).join('\n\n') || 'Nenhuma reflexão'}

---

## Tarefa de Análise

Por favor, analise os dados acima e forneça:

### 1. Pontos Altos (O que está indo bem)
- Identifique padrões positivos
- Destaque conquistas e progressos
- Reconheça consistência em áreas específicas

### 2. Pontos de Atenção (O que precisa melhorar)
- Identifique áreas negligenciadas
- Aponte inconsistências ou quedas
- Sinalize riscos para objetivos

### 3. Análise de Equilíbrio
- Avalie o equilíbrio entre diferentes áreas da vida (trabalho, saúde, aprendizado, etc.)
- Identifique se há sobrecarga em alguma área
- Sugira ajustes para melhor equilíbrio

### 4. Recomendações Específicas
- 3 ações concretas para a próxima semana
- Sugestões de novas metas ou ajustes nas existentes
- Estratégias para manter/aumentar streaks

### 5. Foco Sugerido
- Qual deve ser a prioridade número 1 na próxima semana?
- Por quê?

### 6. Mensagem Motivacional
- Uma mensagem personalizada baseada no progresso do usuário

Por favor, seja específico, prático e encorajador em sua análise.`;

  return {
    rawData: {
      exportedAt: now.toISOString(),
      character,
      quests: allQuests,
      objectives: allObjectives,
      reflections: allReflections,
      checkIns: allCheckIns,
      checkInStreaks: allCheckInStreaks,
      xpEvents: allXPEvents,
      achievements: allAchievements,
      activityGoals: allActivityGoals,
      customCategories,
    },
    last7Days: {
      quests: last7DaysQuests,
      reflections: last7DaysReflections,
      checkIns: last7DaysCheckIns,
      xpEvents: last7DaysXPEvents,
    },
    summary,
    aiAnalysisPrompt,
  };
}


// Função para importar dados
export async function importAllData(data: Partial<{
  character: Character[];
  activities: ActivityLog[];
  quests: Quest[];
  objectives: Objective[];
  reflections: Reflection[];
  weeklyReports: WeeklyReport[];
  achievements: Achievement[];
  xpEvents: XPEvent[];
  dailySnapshots: DailySnapshot[];
  aiInsights: AIInsight[];
  activityGoals: ActivityGoal[];
  goalProgress: GoalProgress[];
  debuffs: Debuff[];
  customCategories: CustomActivityCategory[];
  checkIns: CheckIn[];
  checkInStreaks: CheckInStreak[];
  ankiDecks: AnkiDeck[];
  ankiReviews: AnkiReview[];
  ankiSnapshots: AnkiSnapshot[];
  subjects: Subject[];
  subjectTopics: SubjectTopic[];
  subjectExams: SubjectExam[];
}>): Promise<void> {
  // Importar dados (merge via bulkPut)
  if (data.character?.length) {
    await db.character.clear();
    await db.character.bulkPut(data.character);
  }
  if (data.activities?.length) await db.activities.bulkPut(data.activities);
  if (data.quests?.length) await db.quests.bulkPut(data.quests);
  if (data.objectives?.length) await db.objectives.bulkPut(data.objectives);
  if (data.reflections?.length) await db.reflections.bulkPut(data.reflections);
  if (data.weeklyReports?.length) await db.weeklyReports.bulkPut(data.weeklyReports);
  if (data.achievements?.length) await db.achievements.bulkPut(data.achievements);
  if (data.xpEvents?.length) await db.xpEvents.bulkPut(data.xpEvents);
  if (data.dailySnapshots?.length) await db.dailySnapshots.bulkPut(data.dailySnapshots);
  if (data.aiInsights?.length) await db.aiInsights.bulkPut(data.aiInsights);
  if (data.activityGoals?.length) await db.activityGoals.bulkPut(data.activityGoals);
  if (data.goalProgress?.length) await db.goalProgress.bulkPut(data.goalProgress);
  if (data.debuffs?.length) await db.debuffs.bulkPut(data.debuffs);
  if (data.customCategories?.length) await db.customCategories.bulkPut(data.customCategories);
  if (data.checkIns?.length) await db.checkIns.bulkPut(data.checkIns);
  if (data.checkInStreaks?.length) await db.checkInStreaks.bulkPut(data.checkInStreaks);
  if (data.ankiDecks?.length) await db.ankiDecks.bulkPut(data.ankiDecks);
  if (data.ankiReviews?.length) await db.ankiReviews.bulkPut(data.ankiReviews);
  if (data.ankiSnapshots?.length) await db.ankiSnapshots.bulkPut(data.ankiSnapshots);
  if (data.subjects?.length) await db.subjects.bulkPut(data.subjects);
  if (data.subjectTopics?.length) await db.subjectTopics.bulkPut(data.subjectTopics);
  if (data.subjectExams?.length) await db.subjectExams.bulkPut(data.subjectExams);
}
