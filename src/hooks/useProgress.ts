import { useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import {
  StudySessionDto,
  trainerKeys,
  useActivitySummaryQuery,
  useStudySessionsQuery,
  useTrainerStatsQuery,
} from './useTrainerApi';

export type StudySession = StudySessionDto;

export interface CourseProgress {
  CourseId: string;
  ProgressPercentage: number;
  TotalLessons: number;
  CompletedLessonIds: string[];
  CompletedAt: string | null;
}

export interface QuizResult {
  Id: string;
  QuizId: string;
  QuizTitle: string;
  CourseId: string;
  Score: number;
  TotalPoints: number;
  Percentage: number;
  Passed: boolean;
  TimeTakenSeconds: number | null;
  TakenAt: string;
}

export interface QuizAttemptReviewItem {
  QuestionId: string;
  Correct: boolean;
  YourAnswer: number | null;
  CorrectOptionIndex: number;
  Explanation: string | null;
}

export interface QuizAttemptResult {
  ResultId: string;
  QuizId: string;
  Score: number;
  TotalPoints: number;
  Percentage: number;
  Passed: boolean;
  Review: QuizAttemptReviewItem[];
}

export interface ProgressStats {
  totalLessonsCompleted: number;
  totalQuizzesTaken: number;
  averageQuizScore: number;
  totalStudyTimeMinutes: number;
  currentStreak: number;
}

/**
 * Trainer progress backed by the API.
 * Pass a courseId to also load that course's per-lesson progress (`courseProgress`).
 * Lesson completion is always an explicit action: call `completeLesson`.
 */
export const useProgress = (courseId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const activeSessionRef = useRef<{ id: string; startedAt: number } | null>(null);

  const statsQuery = useTrainerStatsQuery();
  const activityQuery = useActivitySummaryQuery();
  const sessionsQuery = useStudySessionsQuery();

  const quizResultsQuery = useQuery({
    queryKey: ['quiz-results', user?.Id],
    queryFn: async () => (await api.get<QuizResult[]>('/Quizzes/results/me')).data,
    enabled: !!user,
  });

  const courseProgressQuery = useQuery({
    queryKey: ['course-progress', user?.Id, courseId],
    queryFn: async () => {
      try {
        return (await api.get<CourseProgress>(`/Enrollments/${courseId}/progress`)).data;
      } catch (e) {
        // 404 = not enrolled: no progress, not an error.
        if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!user && !!courseId,
  });

  const invalidateProgress = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course-progress'] }),
      queryClient.invalidateQueries({ queryKey: ['enrollments-me'] }),
      queryClient.invalidateQueries({ queryKey: ['trainer-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['trainer-activity-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['quiz-results'] }),
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] }),
    ]);
  }, [queryClient]);

  const completionMutation = useMutation({
    mutationFn: async (vars: { courseId: string; lessonId: string; completed: boolean }) =>
      (
        await api.put<CourseProgress>(`/Enrollments/${vars.courseId}/lessons/${vars.lessonId}/completion`, {
          Completed: vars.completed,
        })
      ).data,
    onSuccess: () => invalidateProgress(),
  });

  const quizMutation = useMutation({
    mutationFn: async (vars: { quizId: string; answers: Record<string, number>; timeTakenSeconds?: number }) =>
      (
        await api.post<QuizAttemptResult>(`/Quizzes/${vars.quizId}/attempts`, {
          Answers: vars.answers,
          TimeTakenSeconds: vars.timeTakenSeconds,
        })
      ).data,
    onSuccess: (result) => {
      toast({
        title: result.Passed ? 'Quiz Passed!' : 'Quiz Completed',
        description: `You scored ${Math.round(result.Percentage)}%`,
        variant: result.Passed ? 'default' : 'destructive',
      });
      invalidateProgress();
    },
  });

  /** Explicitly mark a lesson complete (or not complete). */
  const completeLesson = async (targetCourseId: string, lessonId: string, completed = true) => {
    try {
      const progress = await completionMutation.mutateAsync({ courseId: targetCourseId, lessonId, completed });
      return { error: null, progress };
    } catch (error) {
      toast({ title: 'Could not update lesson', description: getApiError(error), variant: 'destructive' });
      return { error: error as Error, progress: null };
    }
  };

  /** Submit answers ({ questionId: optionIndex }); the server grades the attempt. */
  const submitQuizAttempt = async (
    quizId: string,
    answers: Record<string, number>,
    timeTakenSeconds?: number
  ) => {
    try {
      const result = await quizMutation.mutateAsync({ quizId, answers, timeTakenSeconds });
      return { error: null, result };
    } catch (error) {
      toast({ title: 'Could not submit quiz', description: getApiError(error), variant: 'destructive' });
      return { error: error as Error, result: null };
    }
  };

  const startStudySession = async (sessionCourseId?: string, lessonId?: string) => {
    if (!user) return { error: new Error('Not authenticated'), sessionId: null };
    try {
      const { data } = await api.post<StudySessionDto>('/study-sessions', {
        CourseId: sessionCourseId,
        LessonId: lessonId,
      });
      activeSessionRef.current = { id: data.Id, startedAt: new Date(data.StartedAt).getTime() };
      return { error: null, sessionId: data.Id };
    } catch (error) {
      return { error: error as Error, sessionId: null };
    }
  };

  const endStudySession = async (sessionId?: string) => {
    const active = activeSessionRef.current;
    const id = sessionId || active?.id;
    if (!user || !id) return { error: new Error('No active session') };
    try {
      const durationSeconds =
        active && active.id === id ? Math.max(0, Math.round((Date.now() - active.startedAt) / 1000)) : undefined;
      await api.put(`/study-sessions/${id}`, { DurationSeconds: durationSeconds, End: true });
      activeSessionRef.current = null;
      await invalidateProgress();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const isLessonCompleted = (lessonId: string) =>
    !!courseProgressQuery.data?.CompletedLessonIds.includes(lessonId);

  const summary = activityQuery.data;
  const stats: ProgressStats | null = summary
    ? {
        totalLessonsCompleted: summary.LessonsCompleted,
        totalQuizzesTaken: summary.QuizzesTaken,
        averageQuizScore: statsQuery.data?.QuizAverage ?? 0,
        totalStudyTimeMinutes: Math.round(summary.TotalStudySeconds / 60),
        currentStreak: summary.Streak,
      }
    : null;

  const loading = !!user && (activityQuery.isLoading || statsQuery.isLoading || quizResultsQuery.isLoading);
  const error =
    activityQuery.error || statsQuery.error || quizResultsQuery.error || courseProgressQuery.error || null;

  return {
    quizResults: quizResultsQuery.data ?? [],
    studySessions: sessionsQuery.data ?? [],
    courseProgress: courseProgressQuery.data ?? null,
    courseProgressLoading: courseProgressQuery.isLoading,
    stats,
    loading,
    error: error ? getApiError(error, 'Failed to load your progress.') : null,
    isCompleting: completionMutation.isPending,
    completeLesson,
    submitQuizAttempt,
    startStudySession,
    endStudySession,
    isLessonCompleted,
    fetchProgressData: invalidateProgress,
  };
};

export { trainerKeys };
