import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** week | month | all */
export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface PointsBreakdown {
  Lessons: number;
  Quizzes: number;
  Courses: number;
  Streak: number;
  Sessions: number;
}

export interface LeaderboardEntry {
  Rank: number | null;
  TrainerId: string;
  TrainerName: string | null;
  Points: number;
  Breakdown: PointsBreakdown;
  LessonsCompleted: number;
  /** Average of the best attempt per quiz in the period, 0-100; null when no quiz was taken. */
  QuizAverage: number | null;
  CoursesCompleted: number;
  Streak: number;
  LastActiveAt: string | null;
}

export interface Leaderboard {
  Period: LeaderboardPeriod;
  CourseId: string | null;
  CourseTitle: string | null;
  /** A trainer caller gets the top N; instructors/organization/admin get everyone up to the limit. */
  Entries: LeaderboardEntry[];
  Total: number;
  /** The caller's own row when the caller is a trainer (Rank is null when they opted out). */
  Me: LeaderboardEntry | null;
  GeneratedAt: string;
}

export interface LeaderboardFilters {
  courseId?: string;
  period?: LeaderboardPeriod;
  limit?: number;
}

export const leaderboardKeys = {
  get: (userId?: string, filters?: LeaderboardFilters) =>
    ['leaderboard', userId, filters?.courseId ?? '', filters?.period ?? 'all', filters?.limit ?? 0] as const,
};

/** GET /api/leaderboard?courseId=&period=week|month|all&limit= */
export const useLeaderboardQuery = (filters: LeaderboardFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: leaderboardKeys.get(user?.Id, filters),
    queryFn: async () =>
      (
        await api.get<Leaderboard>('/Leaderboard', {
          params: {
            courseId: filters.courseId || undefined,
            period: filters.period || undefined,
            limit: filters.limit || undefined,
          },
        })
      ).data,
    enabled: !!user,
  });
};
