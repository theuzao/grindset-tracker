import { v4 as uuid } from 'uuid';
import { db, getLocalDateString } from '../db';
import type { Subject, SubjectTopic, SubjectExam, ExamType, QuestDifficulty } from '@/types';
import { questRepository } from './questRepository';
import { addIgnoredCanvasCourseId } from '@/features/canvas/canvasConfig';

// ============================================
// Subject (Matéria) CRUD
// ============================================

export const subjectRepository = {
  async getAll(): Promise<Subject[]> {
    const all = await db.subjects.toArray();
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getActive(): Promise<Subject[]> {
    const all = await db.subjects.toArray();
    return all.filter(s => s.isActive);
  },

  async getById(id: string): Promise<Subject | undefined> {
    return db.subjects.get(id);
  },

  async create(input: {
    name: string;
    professor?: string;
    color: string;
    semester: string;
    canvasId?: number;
  }): Promise<Subject> {
    const now = new Date().toISOString();
    const subject: Subject = {
      id: uuid(),
      name: input.name,
      professor: input.professor,
      color: input.color,
      semester: input.semester,
      isActive: true,
      canvasId: input.canvasId,
      createdAt: now,
      updatedAt: now,
    };
    await db.subjects.add(subject);
    return subject;
  },

  async update(id: string, updates: Partial<Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await db.subjects.update(id, { ...updates, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<void> {
    const subject = await db.subjects.get(id);
    // Se veio do Canvas, registra para não reimportar no próximo sync
    if (subject?.canvasId) {
      addIgnoredCanvasCourseId(subject.canvasId);
    }
    // Cascade: apaga tópicos e provas da matéria
    const topics = await db.subjectTopics.where('subjectId').equals(id).toArray();
    await db.subjectTopics.bulkDelete(topics.map(t => t.id));
    const exams = await db.subjectExams.where('subjectId').equals(id).toArray();
    await db.subjectExams.bulkDelete(exams.map(e => e.id));
    await db.subjects.delete(id);
  },

  async toggleActive(id: string): Promise<void> {
    const subject = await db.subjects.get(id);
    if (!subject) return;
    await db.subjects.update(id, { isActive: !subject.isActive, updatedAt: new Date().toISOString() });
  },

  // ============================================
  // Topics (Tópicos)
  // ============================================

  async getTopics(subjectId: string): Promise<SubjectTopic[]> {
    const topics = await db.subjectTopics.where('subjectId').equals(subjectId).toArray();
    return topics.sort((a, b) => a.order - b.order);
  },

  async addTopic(subjectId: string, title: string): Promise<SubjectTopic> {
    const existing = await this.getTopics(subjectId);
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(t => t.order)) : -1;
    const now = new Date().toISOString();
    const topic: SubjectTopic = {
      id: uuid(),
      subjectId,
      title,
      isDone: false,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.subjectTopics.add(topic);
    return topic;
  },

  async toggleTopic(topicId: string): Promise<void> {
    const topic = await db.subjectTopics.get(topicId);
    if (!topic) return;
    await db.subjectTopics.update(topicId, {
      isDone: !topic.isDone,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateTopicTitle(topicId: string, title: string): Promise<void> {
    await db.subjectTopics.update(topicId, { title, updatedAt: new Date().toISOString() });
  },

  async deleteTopic(topicId: string): Promise<void> {
    await db.subjectTopics.delete(topicId);
  },

  async getProgress(subjectId: string): Promise<{ total: number; done: number; percentage: number }> {
    const topics = await this.getTopics(subjectId);
    const total = topics.length;
    const done = topics.filter(t => t.isDone).length;
    return { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 };
  },

  // ============================================
  // Exams (Provas e Avaliações)
  // ============================================

  async getExams(subjectId: string): Promise<SubjectExam[]> {
    const exams = await db.subjectExams.where('subjectId').equals(subjectId).toArray();
    return exams.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  },

  async addExam(input: {
    subjectId: string;
    title: string;
    type: ExamType;
    scheduledDate: string;
    weight: number;
    maxGrade?: number;
    notes?: string;
    canvasId?: number;
  }): Promise<SubjectExam> {
    const now = new Date().toISOString();
    const exam: SubjectExam = {
      id: uuid(),
      subjectId: input.subjectId,
      title: input.title,
      type: input.type,
      scheduledDate: input.scheduledDate,
      weight: input.weight,
      maxGrade: input.maxGrade ?? 10,
      notes: input.notes,
      canvasId: input.canvasId,
      createdAt: now,
      updatedAt: now,
    };
    await db.subjectExams.add(exam);
    return exam;
  },

  async updateExam(id: string, updates: Partial<Omit<SubjectExam, 'id' | 'subjectId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await db.subjectExams.update(id, { ...updates, updatedAt: new Date().toISOString() });
  },

  async deleteExam(id: string): Promise<void> {
    await db.subjectExams.delete(id);
  },

  async getWeightedAverage(subjectId: string): Promise<number | null> {
    const exams = await this.getExams(subjectId);
    const graded = exams.filter(e => e.grade !== undefined && e.grade !== null);
    if (graded.length === 0) return null;

    const totalWeight = graded.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) return null;

    const weightedSum = graded.reduce((sum, e) => sum + (e.grade! / e.maxGrade) * 10 * e.weight, 0);
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  },

  async getUpcomingExams(days = 30): Promise<SubjectExam[]> {
    const today = getLocalDateString();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = getLocalDateString(future);

    const exams = await db.subjectExams
      .where('scheduledDate')
      .between(today, futureStr, true, true)
      .toArray();

    return exams.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  },

  // ============================================
  // Quest Generation
  // ============================================

  async generateDailyQuests(subjectIds: string[]): Promise<number> {
    if (subjectIds.length === 0) return 0;
    const today = getLocalDateString();
    const activeSubjects = (await this.getActive()).filter(s => subjectIds.includes(s.id));

    // Buscar todas as provas dos próximos 30 dias
    const upcomingExams = await this.getUpcomingExams(30);

    let created = 0;

    for (const subject of activeSubjects) {
      const questTitle = `Estudar: ${subject.name}`;

      // Verificar se já existe quest pendente hoje com esse título
      const todayQuests = await db.quests
        .where('scheduledDate')
        .equals(today)
        .filter(q => q.title === questTitle && q.status === 'pending')
        .toArray();

      if (todayQuests.length > 0) continue;

      // Determinar dificuldade com base na prova mais próxima desta matéria
      const subjectExams = upcomingExams.filter(e => e.subjectId === subject.id);
      let difficulty: QuestDifficulty = 'easy';

      if (subjectExams.length > 0) {
        const nextExam = subjectExams[0];
        const examDate = new Date(nextExam.scheduledDate + 'T00:00:00');
        const todayDate = new Date(today + 'T00:00:00');
        const daysUntilExam = Math.ceil((examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExam <= 3) difficulty = 'hard';
        else if (daysUntilExam <= 7) difficulty = 'medium';
      }

      await questRepository.create({
        title: questTitle,
        description: subject.professor ? `Professor: ${subject.professor}` : undefined,
        category: 'daily',
        difficulty,
        recurrence: 'once',
        scheduledDate: today,
        relatedActivity: 'study',
        estimatedDuration: 60,
      });

      created++;
    }

    return created;
  },

  // ============================================
  // Canvas Upsert (sync sem sobrescrever manual)
  // ============================================

  async upsertSubjectFromCanvas(canvasId: number, name: string, semester: string): Promise<Subject> {
    const existing = await db.subjects.where('canvasId').equals(canvasId).first();
    if (existing) {
      // Mantém edições manuais — não sobrescreve nome nem semestre
      return existing;
    }

    // Cores padrão em rotação
    const COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
    const allSubjects = await this.getAll();
    const color = COLORS[allSubjects.length % COLORS.length];

    return this.create({ name, color, semester, canvasId });
  },

  async upsertExamFromCanvas(
    subjectId: string,
    canvasId: number,
    input: { title: string; type: ExamType; scheduledDate: string; weight: number; maxGrade: number }
  ): Promise<{ exam: SubjectExam; isNew: boolean }> {
    const existing = await db.subjectExams.where('canvasId').equals(canvasId).first();
    if (existing) {
      // Atualiza título, data e peso mas mantém nota manual
      await this.updateExam(existing.id, {
        title: input.title,
        scheduledDate: input.scheduledDate,
        weight: input.weight,
        maxGrade: input.maxGrade,
      });
      return { exam: { ...existing, ...input }, isNew: false };
    }

    const exam = await this.addExam({ subjectId, canvasId, ...input });
    return { exam, isNew: true };
  },
};
