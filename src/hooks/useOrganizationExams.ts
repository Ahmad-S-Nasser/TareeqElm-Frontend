import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** One row of GET /api/organization/exams: a read-only aggregation over Quiz/QuizResult. */
export interface ExamSummary {
  QuizId: string;
  QuizTitle: string;
  CourseId: string;
  CourseTitle: string | null;
  DepartmentId: string | null;
  DepartmentName: string | null;
  QuestionCount: number;
  PassingScore: number;
  AttemptCount: number;
  /** Average of every attempt's percentage (0 when there are none). */
  AverageScore: number;
  /** Percentage of attempts that passed (0 when there are none). */
  PassRate: number;
}

export interface ExamFilters {
  courseId?: string;
  departmentId?: string;
}

export const examKeys = {
  list: (userId?: string, filters: ExamFilters = {}) =>
    ['organization-exams', userId, filters.courseId ?? '', filters.departmentId ?? ''] as const,
  results: (quizId?: string | null) => ['quiz-results', quizId ?? ''] as const,
};

/** GET /api/organization/exams?courseId=&departmentId= (exams.view). */
export const useOrganizationExamsQuery = (filters: ExamFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: examKeys.list(user?.Id, filters),
    queryFn: async () =>
      (
        await api.get<ExamSummary[]>('/organization/exams', {
          params: { courseId: filters.courseId || undefined, departmentId: filters.departmentId || undefined },
        })
      ).data,
    enabled: !!user,
  });
};

/** One row of GET /api/Quizzes/{id}/results. */
export interface QuizResultRow {
  Id: string;
  QuizId: string;
  QuizTitle: string | null;
  CourseId: string | null;
  CourseTitle: string | null;
  TrainerId: string | null;
  TrainerName: string | null;
  Score: number;
  TotalPoints: number;
  Percentage: number;
  Passed: boolean;
  TimeTakenSeconds: number | null;
  TakenAt: string;
}

/** GET /api/Quizzes/{id}/results, reused for the per-exam results drawer (exams.view). */
export const useQuizResultsQuery = (quizId: string | null) =>
  useQuery({
    queryKey: examKeys.results(quizId),
    queryFn: async () => (await api.get<QuizResultRow[]>(`/Quizzes/${quizId}/results`)).data,
    enabled: !!quizId,
  });
