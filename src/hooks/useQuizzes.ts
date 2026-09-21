import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface QuizSummary {
  Id: string;
  CourseId: string;
  CourseTitle: string;
  Title: string;
  QuestionCount: number;
  PassingScore: number;
  TimeLimitMinutes: number | null;
  CreatedAt: string;
}

export interface QuizQuestion {
  Id: string;
  QuestionText: string;
  Options: string[];
  Points: number;
}

export interface QuizDetail {
  Id: string;
  CourseId: string;
  CourseTitle?: string;
  Title: string;
  Description?: string | null;
  PassingScore: number;
  TimeLimitMinutes: number | null;
  Questions: QuizQuestion[];
}

export const quizKeys = {
  list: (userId?: string, courseId?: string) => ['quizzes', userId, courseId ?? 'all'] as const,
  detail: (quizId?: string) => ['quiz', quizId] as const,
};

export const useQuizListQuery = (courseId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: quizKeys.list(user?.Id, courseId),
    queryFn: async () =>
      (await api.get<QuizSummary[]>('/Quizzes', { params: courseId ? { courseId } : undefined })).data,
    enabled: !!user,
  });
};

export const useQuizDetailQuery = (quizId?: string) =>
  useQuery({
    queryKey: quizKeys.detail(quizId),
    queryFn: async () => (await api.get<QuizDetail>(`/Quizzes/${quizId}`)).data,
    enabled: !!quizId,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

export const getHttpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;
