import { getIgnoredCanvasCourseIds } from '@/features/canvas/canvasConfig';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import { getCanvasConfig } from '@/features/canvas/canvasConfig';
import { getLocalDateString } from '@/database/db';
import type { ExamType } from '@/types';

export interface CanvasTerm {
  id: number;
  name: string;
  start_at?: string | null;
  end_at?: string | null;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
  term?: CanvasTerm;
}

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  grading_type: string;
}

interface CanvasSubmission {
  assignment_id: number;
  score: number | null;
  workflow_state: string;
}

async function canvasFetch<T>(path: string): Promise<T> {
  const config = getCanvasConfig();
  if (!config.token) throw new Error('Token do Canvas não configurado');

  const sep = path.includes('?') ? '&' : '?';
  const url = `/canvas-api${path}${sep}per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  });

  if (!res.ok) {
    throw new Error(`Canvas API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

function detectExamType(assignment: CanvasAssignment): ExamType {
  const name = assignment.name.toLowerCase();
  if (name.includes('prova') || name.includes('exam') || name.includes('teste')) return 'prova';
  if (name.includes('trabalho') || name.includes('projeto') || name.includes('relat')) return 'trabalho';
  if (name.includes('seminar') || name.includes('apresent')) return 'seminario';
  return 'outro';
}

function utcToLocalDate(isoUtc: string): string {
  const d = new Date(isoUtc);
  return getLocalDateString(d);
}

function getCurrentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const sem = month <= 6 ? 1 : 2;
  return `${year}.${sem}`;
}

export const canvasService = {
  async checkConnection(): Promise<boolean> {
    try {
      await canvasFetch<{ id: number }>('/users/self');
      return true;
    } catch {
      return false;
    }
  },

  /** Retorna TODOS os cursos do Canvas sem filtragem — para o usuário escolher */
  async getAllCourses(): Promise<CanvasCourse[]> {
    return canvasFetch<CanvasCourse[]>(
      '/courses?include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=invited'
    );
  },

  /** Retorna cursos já importados (canvasId no DB) */
  async getImportedCourseIds(): Promise<number[]> {
    const { db } = await import('@/database/db');
    const subjects = await db.subjects.where('canvasId').above(0).toArray();
    return subjects.map(s => s.canvasId!);
  },

  /**
   * Importa cursos selecionados pelo usuário.
   * Courses que estavam importados mas não estão na lista são removidos.
   */
  async importCourses(
    selectedIds: number[],
    allCourses: CanvasCourse[]
  ): Promise<{ added: number }> {
    const { db } = await import('@/database/db');
    const semester = getCurrentSemester();

    // Importar cursos selecionados que ainda não existem (nunca remove automaticamente)
    const ignored = getIgnoredCanvasCourseIds();
    let added = 0;
    for (const id of selectedIds) {
      if (ignored.includes(id)) continue;
      const course = allCourses.find(c => c.id === id);
      if (!course) continue;
      const existing = await db.subjects.where('canvasId').equals(id).first();
      if (!existing) {
        await subjectRepository.upsertSubjectFromCanvas(id, course.name, semester);
        added++;
      }
    }

    return { added };
  },

  /** Sincroniza apenas assignments e notas para matérias já importadas */
  async syncGrades(): Promise<{ examsCreated: number; gradesUpdated: number; errors: { name: string; reason: string }[] }> {
    const { db } = await import('@/database/db');
    const canvasSubjects = await db.subjects.where('canvasId').above(0).toArray();

    let examsCreated = 0;
    let gradesUpdated = 0;
    const errors: { name: string; reason: string }[] = [];

    for (const subject of canvasSubjects) {
      let assignments: CanvasAssignment[] = [];
      let submissions: CanvasSubmission[] = [];

      try {
        [assignments, submissions] = await Promise.all([
          canvasFetch<CanvasAssignment[]>(`/courses/${subject.canvasId}/assignments`),
          canvasFetch<CanvasSubmission[]>(`/courses/${subject.canvasId}/submissions?student_ids[]=self`),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        // 404 = assignments desabilitado na matéria — não é erro real, apenas pula
        if (!msg.includes('404')) {
          errors.push({
            name: subject.name,
            reason: msg || 'Erro desconhecido',
          });
        }
        continue;
      }

      const submissionMap = new Map<number, number | null>();
      for (const sub of submissions) {
        if (sub.workflow_state === 'graded') {
          submissionMap.set(sub.assignment_id, sub.score);
        }
      }

      for (const assignment of assignments) {
        if (!assignment.due_at || assignment.points_possible === null) continue;

        const scheduledDate = utcToLocalDate(assignment.due_at);
        const type = detectExamType(assignment);
        const maxGrade = assignment.points_possible;

        const { isNew } = await subjectRepository.upsertExamFromCanvas(
          subject.id,
          assignment.id,
          { title: assignment.name, type, scheduledDate, weight: 1, maxGrade }
        );
        if (isNew) examsCreated++;

        if (submissionMap.has(assignment.id)) {
          const rawScore = submissionMap.get(assignment.id);
          if (rawScore !== null && rawScore !== undefined) {
            const grade = Math.round((rawScore / maxGrade) * 10 * 100) / 100;
            const exam = await db.subjectExams.where('canvasId').equals(assignment.id).first();
            if (exam) {
              await subjectRepository.updateExam(exam.id, { grade });
              gradesUpdated++;
            }
          }
        }
      }
    }

    return { examsCreated, gradesUpdated, errors };
  },
};
