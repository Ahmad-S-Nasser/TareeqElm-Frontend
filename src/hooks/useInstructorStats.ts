import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface InstructorStatsResponse {
  Stats: {
    TotalCourses: number;
    TotalTrainers: number;
    CompletionRate: number;
    PendingQuizzes: number;
    AvgQuizScore: number;
  };
  EngagementData: { Week: string; Trainers: number; Completions: number }[];
  CourseDistribution: { Name: string; Value: number }[];
}

export const useInstructorStats = () => {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['instructor-stats'],
    queryFn: async () => (await api.get<InstructorStatsResponse>('/Instructors/me/stats')).data,
    enabled: !!user && (role === 'instructor' || role === 'admin'),
  });
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Translates the stable "W1".."W4" week codes returned by the API ("Week 1"...). */
export const weekLabel = (t: TFn, code: string): string => {
  const match = /^W(\d+)$/i.exec(code);
  return match ? t('instructor:week', { number: Number(match[1]) }) : code;
};

/** Translates the stable course-status codes (Published/Draft/Archived). */
export const courseStatusLabel = (t: TFn, code: string): string => {
  const known = ['Published', 'Draft', 'Archived'];
  return known.includes(code) ? t(`instructor:courseStatus.${code}`) : code;
};
