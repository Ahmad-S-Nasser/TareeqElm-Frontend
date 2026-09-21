import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** One row per trainer per course, as returned by GET /Instructors/me/trainers. */
export interface InstructorTrainerRow {
  TrainerId: string;
  FullName: string;
  Email: string;
  AvatarUrl: string | null;
  CourseId: string;
  CourseTitle: string;
  ProgressPercentage: number;
  EnrolledAt: string;
  CompletedAt: string | null;
  LessonsCompleted: number;
  QuizAverage: number | null;
  LastActive: string | null;
}

export const fetchInstructorTrainerRows = async (courseId?: string): Promise<InstructorTrainerRow[]> => {
  const response = await api.get<InstructorTrainerRow[]>('/Instructors/me/trainers', {
    params: courseId ? { courseId } : undefined,
  });
  return response.data ?? [];
};

/** Trainers enrolled in one of the instructor's courses. */
export const useEnrolledTrainers = (courseId?: string) => {
  const { role } = useAuth();

  const query = useQuery({
    queryKey: ['instructor-trainers', courseId ?? 'all'],
    queryFn: () => fetchInstructorTrainerRows(courseId),
    enabled: !!courseId && (role === 'instructor' || role === 'admin'),
  });

  return {
    trainers: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
