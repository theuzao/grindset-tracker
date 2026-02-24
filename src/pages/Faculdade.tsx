import { useState, useEffect, useMemo, useRef } from 'react';
import {
  School,
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  ClipboardList,
  Zap,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  Calendar,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useSubjects,
  useSubjectTopics,
  useSubjectExams,
  useUpcomingExams,
} from '@/database/hooks';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import { questRepository } from '@/database/repositories/questRepository';
import { canvasService } from '@/services/canvasService';
import { getCanvasConfig } from '@/features/canvas/canvasConfig';
import { getLocalDateString } from '@/database/db';
import type { Subject, SubjectTopic, SubjectExam, ExamType } from '@/types';

const SUBJECT_COLORS = [
  '#6366F1', '#EF4444', '#F59E0B', '#10B981',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#84CC16', '#14B8A6',
];

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  lista: 'Lista',
  seminario: 'Seminário',
  outro: 'Outro',
};

const EXAM_TYPE_COLORS: Record<ExamType, string> = {
  prova: 'text-red-400 bg-red-500/10',
  trabalho: 'text-blue-400 bg-blue-500/10',
  lista: 'text-emerald-400 bg-emerald-500/10',
  seminario: 'text-purple-400 bg-purple-500/10',
  outro: 'text-gray-400 bg-gray-500/10',
};

function daysUntil(dateStr: string): number {
  const today = new Date(getLocalDateString() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function googleCalendarUrl(exam: SubjectExam, subjectName?: string): string {
  const start = toICSDate(exam.scheduledDate);
  // All-day event: end = next day
  const endDate = new Date(exam.scheduledDate + 'T00:00:00');
  endDate.setDate(endDate.getDate() + 1);
  const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;
  const text = encodeURIComponent(`${EXAM_TYPE_LABELS[exam.type]}: ${exam.title}${subjectName ? ` (${subjectName})` : ''}`);
  const details = encodeURIComponent(subjectName ? `Matéria: ${subjectName}\nPeso: ${exam.weight}/${exam.maxGrade}` : '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}


// ============================================
// Main Page
// ============================================

export function Faculdade() {
  const subjects = useSubjects();
  const upcomingExams = useUpcomingExams(7);
  const allFutureExams = useUpcomingExams(365);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const canvasConfig = getCanvasConfig();

  // One-time cleanup: remove quests geradas pelo antigo "Gerar Quests Hoje" automático
  useEffect(() => {
    const KEY = 'study-quests-cleanup-v1';
    if (localStorage.getItem(KEY)) return;
    import('@/database/db').then(({ db }) => {
      db.quests.filter(q => q.title.startsWith('Estudar: ') && q.relatedActivity === 'study').delete();
      localStorage.setItem(KEY, '1');
    });
  }, []);

  const activeSubjects = subjects?.filter(s => s.isActive) ?? [];
  // Map subjectId → earliest future exam date string (for sorting)
  const subjectNextExamDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const exam of allFutureExams ?? []) {
      if (!map[exam.subjectId] || exam.scheduledDate < map[exam.subjectId]) {
        map[exam.subjectId] = exam.scheduledDate;
      }
    }
    return map;
  }, [allFutureExams]);

  const sortedSubjects = useMemo(() => {
    if (!subjects) return [];
    return [...subjects].sort((a, b) => {
      const da = subjectNextExamDate[a.id] ?? '9999-99-99';
      const db = subjectNextExamDate[b.id] ?? '9999-99-99';
      return da.localeCompare(db);
    });
  }, [subjects, subjectNextExamDate]);


  const handleSync = async () => {
    if (!canvasConfig.enabled || !canvasConfig.token) {
      alert('Configure a integração Canvas em Configurações primeiro.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await canvasService.syncGrades();
      const base = `${result.examsCreated} prova(s) nova(s), ${result.gradesUpdated} nota(s) atualizadas.`;
      const errMsg = result.errors.length > 0
        ? ` (${result.errors.length} matéria(s) com erro: ${result.errors.map(e => e.name).join(', ')})`
        : '';
      setSyncResult(base + errMsg);
      setTimeout(() => setSyncResult(null), 6000);
    } catch (err) {
      alert(`Erro ao sincronizar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSubject = async (subject: Subject) => {
    if (window.confirm(`Remover "${subject.name}" e todos os seus tópicos e provas?`)) {
      await subjectRepository.delete(subject.id);
      if (selectedSubject?.id === subject.id) setSelectedSubject(null);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setSelectedSubject(null);
    setShowSubjectModal(true);
  };

  return (
    <div className="min-h-screen">
      <Header title="Faculdade" subtitle="Gerencie suas matérias e acompanhe seu desempenho" />

      <div className="p-6 space-y-5">

        {/* Upcoming Exams Banner */}
        {upcomingExams && upcomingExams.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-white uppercase tracking-wide">
                Tarefas nos próximos 7 dias
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingExams.map((exam) => (
                <ExamChip
                  key={exam.id}
                  exam={exam}
                  days={daysUntil(exam.scheduledDate)}
                  subjects={subjects}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}>
            <Plus size={16} className="mr-1.5" />
            Nova Matéria
          </Button>
          <Button variant="secondary" onClick={() => setShowQuestModal(true)}>
            <Zap size={16} className="mr-1.5" />
            Gerar Quests
          </Button>

          {canvasConfig.enabled && (
            <Button variant="secondary" onClick={handleSync} isLoading={isSyncing}>
              <RefreshCw size={16} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Canvas'}
            </Button>
          )}
          {syncResult && (
            <span className="text-sm text-accent font-medium bg-accent/10 px-3 py-1.5 rounded-lg">
              {syncResult}
            </span>
          )}
        </div>

        {/* Subject Grid */}
        {subjects && sortedSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedSubjects.map((subject) => (
              <SubjectGridCard
                key={subject.id}
                subject={subject}
                onView={() => setSelectedSubject(subject)}
                onEdit={() => handleEdit(subject)}
                onDelete={() => handleDeleteSubject(subject)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mb-5">
              <School size={36} className="text-gray-600" />
            </div>
            <p className="font-semibold text-gray-300 text-lg">Nenhuma matéria cadastrada</p>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              Adicione suas matérias ou sincronize com o Canvas
            </p>
            <Button onClick={() => setShowSubjectModal(true)}>
              <Plus size={16} className="mr-1.5" />
              Adicionar Matéria
            </Button>
          </div>
        )}
      </div>

      {/* Subject Detail Modal */}
      {selectedSubject && (
        <SubjectDetailModal
          subject={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          onEdit={() => handleEdit(selectedSubject)}
          onDelete={() => handleDeleteSubject(selectedSubject)}
        />
      )}

      {/* Create/Edit Modal */}
      <SubjectFormModal
        isOpen={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        editingSubject={editingSubject}
      />

      {/* Generate Quests Modal */}
      <GenerateQuestsModal
        isOpen={showQuestModal}
        onClose={() => setShowQuestModal(false)}
        subjects={activeSubjects}
        onGenerated={(count) => {
          setSyncResult(count > 0 ? `${count} quest(s) criada(s)!` : 'Quests já existem para hoje.');
          setTimeout(() => setSyncResult(null), 3000);
        }}
      />
    </div>
  );
}

// ============================================
// Generate Quests Modal
// ============================================

function GenerateQuestsModal({
  isOpen,
  onClose,
  subjects,
  onGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onGenerated: (count: number) => void;
}) {
  const allExams = useUpcomingExams(14);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) setSelected(new Set(subjects.map(s => s.id)));
  }, [isOpen, subjects]);

  // Sugestões: matérias com prova/trabalho nos próximos 14 dias, mais urgentes primeiro
  const suggestions = useMemo(() => {
    if (!allExams) return [];
    const seen = new Set<string>();
    return allExams
      .filter(e => {
        if (seen.has(e.subjectId)) return false;
        seen.add(e.subjectId);
        return true;
      })
      .slice(0, 4)
      .map(exam => ({
        exam,
        subject: subjects.find(s => s.id === exam.subjectId),
        days: daysUntil(exam.scheduledDate),
      }))
      .filter(x => x.subject != null) as { exam: SubjectExam; subject: Subject; days: number }[];
  }, [allExams, subjects]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === subjects.length) setSelected(new Set());
    else setSelected(new Set(subjects.map(s => s.id)));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const count = await subjectRepository.generateDailyQuests(Array.from(selected));
      onGenerated(count);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerar Quests de Estudo" size="sm">
      <div className="space-y-4">

        {/* Sugestões de urgência */}
        {suggestions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Sugestões por prazo</p>
            <div className="space-y-1.5">
              {suggestions.map(({ exam, subject, days }) => {
                const urgency = days <= 2 ? 'border-red-500/40 bg-red-500/8 text-red-300'
                  : days <= 5 ? 'border-red-500/25 bg-red-500/5 text-red-400'
                  : 'border-red-500/15 bg-red-500/3 text-red-500/70';
                return (
                  <button
                    key={exam.id}
                    onClick={() => setSelected(prev => new Set([...prev, subject.id]))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-opacity ${urgency} ${selected.has(subject.id) ? 'opacity-50' : ''}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-200 truncate">{subject.name}</p>
                      <p className="text-xs opacity-80 truncate">{exam.title}</p>
                    </div>
                    <span className="text-xs font-bold shrink-0">
                      {days === 0 ? 'hoje' : `${days}d`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Seleção de matérias */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Matérias</p>
            <button onClick={toggleAll} className="text-xs text-accent hover:underline">
              {selected.size === subjects.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-tertiary transition-colors text-left"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-sm text-gray-200">{s.name}</span>
                {selected.has(s.id)
                  ? <CheckSquare size={16} className="text-accent shrink-0" />
                  : <Square size={16} className="text-gray-600 shrink-0" />
                }
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleGenerate}
            isLoading={isGenerating}
            disabled={selected.size === 0}
          >
            <Zap size={15} className="mr-1.5" />
            Gerar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Create Quest Modal (from topic/exam)
// ============================================

const DIFF_LABELS = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' } as const;

function CreateQuestModal({
  isOpen,
  onClose,
  defaultTitle,
  defaultDescription,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle: string;
  defaultDescription?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [duration, setDuration] = useState(45);
  const [date, setDate] = useState(getLocalDateString());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setDifficulty('medium');
      setDuration(45);
      setDate(getLocalDateString());
    }
  }, [isOpen, defaultTitle]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await questRepository.create({
        title: title.trim(),
        description: defaultDescription ?? '',
        category: 'daily',
        difficulty,
        recurrence: 'once',
        scheduledDate: date,
        relatedActivity: 'study',
        estimatedDuration: duration,
      });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Quest" size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Dificuldade</label>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  difficulty === d
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-bg-tertiary border-border text-gray-400 hover:border-gray-500'
                }`}
              >
                {DIFF_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Duração (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 45)}
              className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        {defaultDescription && (
          <p className="text-xs text-gray-600 italic">{defaultDescription}</p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleCreate} isLoading={creating} disabled={!title.trim()}>
            <Zap size={14} className="mr-1.5" />
            Criar Quest
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Exam Chip (banner)
// ============================================

function ExamChip({
  exam,
  days,
  subjects,
}: {
  exam: SubjectExam;
  days: number;
  subjects: Subject[] | undefined;
}) {
  const subject = subjects?.find(s => s.id === exam.subjectId);
  const urgencyBorder =
    days <= 1 ? 'border-red-500/40 bg-red-500/8'
    : days <= 3 ? 'border-red-500/25 bg-red-500/5'
    : 'border-red-500/15 bg-red-500/3';
  const daysColor =
    days <= 1 ? 'text-red-300' : days <= 3 ? 'text-red-400' : 'text-red-500/70';

  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border ${urgencyBorder}`}>
      {subject && (
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-200 truncate max-w-[140px]">{exam.title}</p>
        {subject && <p className="text-xs text-gray-500">{subject.name}</p>}
      </div>
      <span className={`text-xs font-bold shrink-0 ${daysColor}`}>
        {days === 0 ? 'hoje' : `${days}d`}
      </span>
    </div>
  );
}

// ============================================
// Subject Grid Card
// ============================================

const TOPIC_PREVIEW = 4;

function SubjectGridCard({
  subject,
  onView,
  onEdit,
  onDelete,
}: {
  subject: Subject;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const topics = useSubjectTopics(subject.id);
  const exams = useSubjectExams(subject.id);

  const total = topics?.length ?? 0;
  const done = topics?.filter(t => t.isDone).length ?? 0;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  const nextExam = exams?.find(e => daysUntil(e.scheduledDate) >= 0);
  const nextExamDays = nextExam ? daysUntil(nextExam.scheduledDate) : null;
  const urgentExams = exams
    ?.filter(e => { const d = daysUntil(e.scheduledDate); return d >= 0 && d <= 7; })
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    ?? [];

  // Preview: show context around the current progress point
  const firstPendingIdx = topics?.findIndex(t => !t.isDone) ?? -1;
  const previewStart = firstPendingIdx <= 0
    ? 0
    : Math.max(0, firstPendingIdx - 1);
  const previewTopics = topics?.slice(previewStart, previewStart + TOPIC_PREVIEW) ?? [];
  const hiddenCount = total - previewStart - previewTopics.length;

  return (
    <Card
      className={`p-0 overflow-hidden flex flex-col transition-all hover:border-border/80 hover:shadow-lg cursor-pointer ${
        !subject.isActive ? 'opacity-60' : ''
      }`}
      onClick={onView}
    >
      {/* Top color strip */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: subject.color }} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white leading-tight">{subject.name}</p>
            {subject.professor && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subject.professor}</p>
            )}
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
            style={{ backgroundColor: `${subject.color}22`, color: subject.color }}
          >
            {subject.semester}
          </span>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percentage}%`, backgroundColor: subject.color }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{done} concluídos</span>
              <span>{total} total</span>
            </div>
          </div>
        )}

        {/* Next urgent exam banner */}
        {urgentExams.length > 0 && (() => {
          const next = urgentExams[0];
          const d = daysUntil(next.scheduledDate);
          return (
            <div className="flex items-center gap-2 border-t border-border/50 pt-2">
              <span className="text-xs text-gray-300 truncate flex-1">
                {next.title}{' '}
                <span className={`font-semibold ${d <= 1 ? 'text-red-400' : d <= 3 ? 'text-red-500' : 'text-red-600'}`}>
                  {d === 0 ? 'hoje!' : `em ${d} dia${d !== 1 ? 's' : ''}`}
                </span>
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${EXAM_TYPE_COLORS[next.type]}`}>
                {EXAM_TYPE_LABELS[next.type]}
              </span>
            </div>
          );
        })()}

        {/* Topic preview */}
        {previewTopics.length > 0 ? (
          <div className="space-y-1 border-t border-border/50 pt-2">
            {previewTopics.map((topic) => (
              <div
                key={topic.id}
                className={`flex items-start gap-2 rounded px-1.5 -mx-1.5 ${
                  topic.isDone ? 'bg-green-500/10' : ''
                }`}
              >
                {topic.isDone ? (
                  <CheckSquare size={13} className="text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Square size={13} className="text-gray-600 shrink-0 mt-0.5" />
                )}
                <span
                  className={`text-xs leading-snug line-clamp-1 ${
                    topic.isDone ? 'text-green-400/70 line-through' : 'text-gray-300'
                  }`}
                >
                  {topic.title}
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="text-xs text-gray-600 pl-5">+{hiddenCount} tópicos</p>
            )}
          </div>
        ) : total === 0 ? (
          <p className="text-xs text-gray-700 italic border-t border-border/50 pt-2">
            Sem tópicos cadastrados
          </p>
        ) : null}

        {/* Bottom: badges + actions */}
        <div className="mt-auto space-y-2.5">
          {/* Badges */}
          {nextExamDays !== null && nextExamDays > 7 && (
            <div className="flex items-center gap-2">
              <span className="text-xs flex items-center gap-1 text-gray-500">
                <Calendar size={11} />
                {`${nextExamDays}d`}
              </span>
            </div>
          )}

          {/* Footer actions */}
          <div
            className="flex items-center gap-1.5 pt-2.5 border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onView}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <ExternalLink size={12} />
              Abrir
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-bg-tertiary transition-colors"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Subject Detail Modal
// ============================================

function SubjectDetailModal({
  subject,
  onClose,
  onEdit,
  onDelete,
}: {
  subject: Subject;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const topics = useSubjectTopics(subject.id);
  const exams = useSubjectExams(subject.id);
  const [activeTab, setActiveTab] = useState<'topics' | 'exams'>('topics');
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [showAddExam, setShowAddExam] = useState(false);
  const [average, setAverage] = useState<number | null>(null);

  const total = topics?.length ?? 0;
  const done = topics?.filter(t => t.isDone).length ?? 0;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    subjectRepository.getWeightedAverage(subject.id).then(setAverage);
  }, [subject.id, exams]);

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return;
    await subjectRepository.addTopic(subject.id, newTopicTitle.trim());
    setNewTopicTitle('');
    setShowAddTopic(false);
  };

  return (
    <Modal isOpen onClose={onClose} size="2xl">
      {/* Custom header */}
      <div className="-mt-5 -mx-5 mb-4">
        {/* Color strip */}
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: subject.color }} />

        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-white">{subject.name}</h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${subject.color}22`, color: subject.color }}
              >
                {subject.semester}
              </span>
              {subject.canvasId && (
                <span className="text-xs text-accent/60 font-medium">Canvas</span>
              )}
            </div>
            {subject.professor && (
              <p className="text-sm text-gray-500 mt-0.5">{subject.professor}</p>
            )}

            {/* Progress summary */}
            {total > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-32 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, backgroundColor: subject.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{done}/{total} tópicos</span>
                </div>
                {average !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      average >= 7 ? 'bg-green-500/10 text-green-400'
                      : average >= 5 ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    Média {average.toFixed(1)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-3">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-bg-tertiary transition-colors"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={() => { onDelete(); }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 border-b border-border bg-bg-secondary">
          {(['topics', 'exams'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 mr-6 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'topics' ? <BookOpen size={14} /> : <ClipboardList size={14} />}
              {tab === 'topics' ? `Tópicos (${total})` : `Provas (${exams?.length ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'topics' && (
        <TopicsTab
          subjectId={subject.id}
          subjectName={subject.name}
          topics={topics}
          showAddTopic={showAddTopic}
          newTopicTitle={newTopicTitle}
          onNewTopicTitleChange={setNewTopicTitle}
          onAddTopic={handleAddTopic}
          onShowAdd={() => setShowAddTopic(true)}
          onCancelAdd={() => { setShowAddTopic(false); setNewTopicTitle(''); }}
        />
      )}
      {activeTab === 'exams' && (
        <ExamsTab
          subjectId={subject.id}
          subjectName={subject.name}
          exams={exams}
          average={average}
          showAddExam={showAddExam}
          onShowAdd={() => setShowAddExam(true)}
          onCloseAdd={() => setShowAddExam(false)}
        />
      )}
    </Modal>
  );
}

// ============================================
// Topics Tab
// ============================================

function TopicsTab({
  subjectId,
  subjectName,
  topics,
  showAddTopic,
  newTopicTitle,
  onNewTopicTitleChange,
  onAddTopic,
  onShowAdd,
  onCancelAdd,
}: {
  subjectId: string;
  subjectName: string;
  topics: SubjectTopic[] | undefined;
  showAddTopic: boolean;
  newTopicTitle: string;
  onNewTopicTitleChange: (v: string) => void;
  onAddTopic: () => void;
  onShowAdd: () => void;
  onCancelAdd: () => void;
}) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleBulkImport = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    setIsImporting(true);
    try {
      for (const line of lines) {
        await subjectRepository.addTopic(subjectId, line);
      }
      setBulkText('');
      setShowBulkImport(false);
    } finally {
      setIsImporting(false);
    }
  };

  const total = topics?.length ?? 0;
  const done = topics?.filter(t => t.isDone).length ?? 0;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  const pending = topics?.filter(t => !t.isDone) ?? [];
  const completed = topics?.filter(t => t.isDone) ?? [];

  return (
    <div>
      {/* Progress header */}
      {total > 0 && (
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
          <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0 font-medium">
            {done}/{total}
            <span className="text-gray-600 ml-1">({percentage}%)</span>
          </span>
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-10">
          <BookOpen size={24} className="mx-auto mb-2 text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum tópico ainda.</p>
          <p className="text-xs text-gray-600 mt-0.5">Adicione capítulos ou temas desta matéria.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Pending topics */}
          {pending.length > 0 && (
            <div>
              {pending.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  index={topics!.indexOf(topic)}
                  subjectName={subjectName}
                />
              ))}
            </div>
          )}

          {/* Completed topics */}
          {completed.length > 0 && (
            <div className={pending.length > 0 ? 'mt-3 pt-3 border-t border-border/50' : ''}>
              {pending.length > 0 && (
                <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1.5 px-3">
                  Concluídos ({completed.length})
                </p>
              )}
              {completed.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  index={topics!.indexOf(topic)}
                  subjectName={subjectName}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single add */}
      {showAddTopic && !showBulkImport && (
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newTopicTitle}
            onChange={(e) => onNewTopicTitleChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTopic()}
            placeholder="Nome do tópico"
            autoFocus
            className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
          <Button size="sm" onClick={onAddTopic}>Adicionar</Button>
          <Button size="sm" variant="secondary" onClick={onCancelAdd}>Cancelar</Button>
        </div>
      )}

      {/* Bulk import */}
      {showBulkImport && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">Um tópico por linha:</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Recursividade\nAnálise de Algoritmos\nPilhas\n..."}
            autoFocus
            rows={8}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent resize-none font-mono"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleBulkImport} isLoading={isImporting}>
              Importar {bulkText.split('\n').filter(l => l.trim()).length > 0
                ? `(${bulkText.split('\n').filter(l => l.trim()).length})`
                : ''}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowBulkImport(false); setBulkText(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showAddTopic && !showBulkImport && (
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={onShowAdd}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={14} />
            Novo tópico
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <FileText size={14} />
            Importar em lote
          </button>
        </div>
      )}
    </div>
  );
}

function TopicRow({ topic, index, subjectName }: { topic: SubjectTopic; index: number; subjectName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.title);
  const [showQuestModal, setShowQuestModal] = useState(false);

  const handleToggle = () => subjectRepository.toggleTopic(topic.id);
  const handleDelete = () => subjectRepository.deleteTopic(topic.id);

  const startEdit = () => {
    setDraft(topic.title);
    setEditing(true);
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== topic.title) {
      await subjectRepository.updateTopicTitle(topic.id, trimmed);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(topic.title);
    setEditing(false);
  };

  return (
    <div
      className={`flex items-center gap-3 group px-3 py-2.5 rounded-lg transition-all ${
        topic.isDone
          ? 'bg-green-500/5 hover:bg-green-500/8'
          : 'hover:bg-bg-tertiary/60'
      }`}
    >
      {/* Number */}
      <span className="text-xs text-gray-700 w-5 text-right shrink-0 font-mono select-none">
        {index + 1}
      </span>

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className="shrink-0 transition-colors"
        title={topic.isDone ? 'Marcar como pendente' : 'Marcar como concluído'}
      >
        {topic.isDone
          ? <CheckSquare size={17} className="text-green-500" />
          : <Square size={17} className="text-gray-500 hover:text-accent" />
        }
      </button>

      {/* Title / Inline edit */}
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
          className="flex-1 px-2 py-0.5 bg-bg-primary border border-accent rounded text-sm text-white focus:outline-none"
        />
      ) : (
        <span
          onClick={startEdit}
          className={`flex-1 text-sm leading-snug cursor-text ${
            topic.isDone
              ? 'line-through text-gray-500 decoration-gray-600'
              : 'text-gray-200 hover:text-white'
          }`}
          title="Clique para editar"
        >
          {topic.title}
        </span>
      )}

      {/* Actions */}
      {!editing && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
          {!topic.isDone && (
            <button
              onClick={() => setShowQuestModal(true)}
              title="Criar quest para este tópico"
              className="p-1 rounded text-gray-600 hover:text-accent transition-colors"
            >
              <Zap size={12} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      <CreateQuestModal
        isOpen={showQuestModal}
        onClose={() => setShowQuestModal(false)}
        defaultTitle={`Estudar: ${topic.title}`}
        defaultDescription={`Matéria: ${subjectName}`}
      />
    </div>
  );
}

// ============================================
// Exams Tab
// ============================================

function ExamsTab({
  subjectId,
  subjectName,
  exams,
  average,
  showAddExam,
  onShowAdd,
  onCloseAdd,
}: {
  subjectId: string;
  subjectName: string;
  exams: SubjectExam[] | undefined;
  average: number | null;
  showAddExam: boolean;
  onShowAdd: () => void;
  onCloseAdd: () => void;
}) {
  const [editingExam, setEditingExam] = useState<SubjectExam | null>(null);

  const sortedExams = exams
    ? [...exams].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    : [];

  return (
    <div className="space-y-2">
      {sortedExams.length > 0 ? (
        <>
          {sortedExams.map((exam) => (
            <ExamRow key={exam.id} exam={exam} subjectName={subjectName} onEdit={() => setEditingExam(exam)} />
          ))}

          <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Média Ponderada
            </span>
            <div className="flex items-center gap-2">
              {average !== null && average < 5 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle size={11} />
                  Abaixo do mínimo
                </span>
              )}
              <span
                className={`text-base font-bold ${
                  average === null ? 'text-gray-500'
                  : average >= 7 ? 'text-green-400'
                  : average >= 5 ? 'text-yellow-400'
                  : 'text-red-400'
                }`}
              >
                {average !== null ? `${average.toFixed(2)}/10` : '–'}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <ClipboardList size={24} className="mx-auto mb-2 text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma prova cadastrada.</p>
        </div>
      )}

      <button
        onClick={onShowAdd}
        className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 mt-2 transition-colors"
      >
        <Plus size={14} />
        Nova prova/avaliação
      </button>

      {showAddExam && (
        <ExamForm subjectId={subjectId} onClose={onCloseAdd} />
      )}

      {editingExam && (
        <ExamForm subjectId={subjectId} exam={editingExam} onClose={() => setEditingExam(null)} />
      )}
    </div>
  );
}

function ExamRow({ exam, subjectName, onEdit }: { exam: SubjectExam; subjectName: string; onEdit: () => void }) {
  const [editingGrade, setEditingGrade] = useState(false);
  const [gradeInput, setGradeInput] = useState(exam.grade?.toString() ?? '');
  const [showQuestModal, setShowQuestModal] = useState(false);
  const days = daysUntil(exam.scheduledDate);
  const isPast = days < 0;

  const handleSaveGrade = async () => {
    const grade = parseFloat(gradeInput);
    if (!isNaN(grade) && grade >= 0 && grade <= exam.maxGrade) {
      await subjectRepository.updateExam(exam.id, { grade });
    }
    setEditingGrade(false);
  };

  const handleToggleDone = () => subjectRepository.updateExam(exam.id, { isDone: !exam.isDone });
  const handleDelete = () => subjectRepository.deleteExam(exam.id);

  const cardClass = exam.isDone
    ? 'bg-green-500/8 border-green-500/30 hover:border-green-500/50'
    : !isPast && days <= 7
      ? days <= 1
        ? 'bg-red-500/8 border-red-500/40 hover:border-red-500/60'
        : days <= 3
          ? 'bg-red-500/5 border-red-500/25 hover:border-red-500/40'
          : 'bg-red-500/3 border-red-500/15 hover:border-red-500/25'
      : 'bg-bg-tertiary/40 border-border/40 hover:border-border';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border group transition-all ${cardClass}`}>
      <button
        onClick={handleToggleDone}
        title={exam.isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
        className={`shrink-0 transition-colors ${exam.isDone ? 'text-green-500' : 'text-gray-600 hover:text-green-500'}`}
      >
        {exam.isDone ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${exam.isDone ? 'text-gray-400 line-through' : 'text-white'}`}>
            {exam.title}
          </p>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EXAM_TYPE_COLORS[exam.type]}`}>
            {EXAM_TYPE_LABELS[exam.type]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{formatDate(exam.scheduledDate)}</span>
          {!isPast && !exam.isDone && (
            <span className={days <= 7 ? 'text-red-400 font-medium' : ''}>
              {days === 0 ? 'hoje' : `${days}d`}
            </span>
          )}
          <span>• Peso {exam.weight}</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        {editingGrade ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={exam.maxGrade}
              step={0.1}
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGrade(); }}
              autoFocus
              className="w-16 px-2 py-1 bg-bg-primary border border-border rounded text-white text-sm focus:outline-none focus:border-accent"
            />
            <button onClick={handleSaveGrade} className="text-xs text-accent font-medium">OK</button>
          </div>
        ) : (
          <button
            onClick={() => { setGradeInput(exam.grade?.toString() ?? ''); setEditingGrade(true); }}
            title="Clique para editar nota"
          >
            {exam.grade !== undefined ? (
              <span
                className={`text-sm font-bold ${
                  (exam.grade / exam.maxGrade) * 10 >= 5 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {exam.grade.toFixed(1)}/{exam.maxGrade}
              </span>
            ) : (
              <span className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                –/{exam.maxGrade}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
        {!isPast && (
          <>
            <a
              href={googleCalendarUrl(exam, subjectName)}
              target="_blank"
              rel="noopener noreferrer"
              title="Adicionar ao Google Calendar"
              className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
            >
              <Calendar size={12} />
            </a>
            <button
              onClick={() => setShowQuestModal(true)}
              title="Criar quest para esta tarefa"
              className="p-1 text-gray-500 hover:text-accent transition-colors"
            >
              <Zap size={12} />
            </button>
          </>
        )}
        <button
          onClick={onEdit}
          className="p-1 text-gray-500 hover:text-accent transition-colors"
        >
          <Edit3 size={12} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <CreateQuestModal
        isOpen={showQuestModal}
        onClose={() => setShowQuestModal(false)}
        defaultTitle={`Preparar: ${exam.title}`}
        defaultDescription={`${EXAM_TYPE_LABELS[exam.type]} — ${formatDate(exam.scheduledDate)}`}
      />
    </div>
  );
}

function ExamForm({ subjectId, exam, onClose }: { subjectId: string; exam?: SubjectExam; onClose: () => void }) {
  const [title, setTitle] = useState(exam?.title ?? '');
  const [type, setType] = useState<ExamType>(exam?.type ?? 'prova');
  const [date, setDate] = useState(exam?.scheduledDate ?? '');
  const [weight, setWeight] = useState(exam?.weight ?? 1);
  const [maxGrade, setMaxGrade] = useState(exam?.maxGrade ?? 10);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setIsLoading(true);
    try {
      if (exam) {
        await subjectRepository.updateExam(exam.id, {
          title: title.trim(),
          type,
          scheduledDate: date,
          weight,
          maxGrade,
        });
      } else {
        await subjectRepository.addExam({
          subjectId,
          title: title.trim(),
          type,
          scheduledDate: date,
          weight,
          maxGrade,
        });
      }
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="p-3 bg-bg-tertiary rounded-lg border border-border space-y-3 mt-2"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da prova / trabalho"
            required
            className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ExamType)}
          className="px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
        >
          {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
        />
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Peso</label>
          <input
            type="number"
            min={1}
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nota máx.</label>
          <input
            type="number"
            min={1}
            value={maxGrade}
            onChange={(e) => setMaxGrade(parseFloat(e.target.value) || 10)}
            className="w-full px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isLoading}>{exam ? 'Salvar' : 'Adicionar'}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

// ============================================
// Subject Form Modal (Create / Edit)
// ============================================

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSubject?: Subject | null;
}

function SubjectFormModal({ isOpen, onClose, editingSubject }: SubjectFormModalProps) {
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [semester, setSemester] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}.${now.getMonth() < 6 ? 1 : 2}`;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && editingSubject) {
      setName(editingSubject.name);
      setProfessor(editingSubject.professor ?? '');
      setColor(editingSubject.color);
      setSemester(editingSubject.semester);
    } else if (isOpen) {
      setName('');
      setProfessor('');
      setColor(SUBJECT_COLORS[0]);
    }
  }, [isOpen, editingSubject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingSubject) {
        await subjectRepository.update(editingSubject.id, {
          name: name.trim(),
          professor: professor.trim() || undefined,
          color,
          semester,
        });
      } else {
        await subjectRepository.create({
          name: name.trim(),
          professor: professor.trim() || undefined,
          color,
          semester,
        });
      }
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSubject ? 'Editar Matéria' : 'Nova Matéria'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cálculo I"
            required
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Professor</label>
            <input
              type="text"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Opcional"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Semestre</label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="2026.1"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2.5">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingSubject ? 'Salvar' : 'Criar Matéria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
