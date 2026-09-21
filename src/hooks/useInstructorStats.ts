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
