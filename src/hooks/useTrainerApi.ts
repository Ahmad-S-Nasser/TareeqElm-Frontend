import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

// Shared, typed react-query hooks for the trainer statistics endpoints.

export interface TrainerData {
  TotalStudyHours: number;
  AvgFocusScore: number;
  Streak: number;
  FlashcardsDue: number;
  WeakTopics: string[];
  BestStudyTime: string;
  CoursesEnrolled: number;
  LessonsCompleted: number;
  QuizAverage: number;
  CardsReviewedToday: number;
  SessionsThisWeek: number;
  TotalCards: number;
  RetentionRate: number;
  TimeBlocksToday: number;
  DeepWorkSessions: number;
}

export interface ActivitySummary {
  TotalSessions: number;
  TotalStudySeconds: number;
  CardsCreated: number;
  CardsReviewed: number;
  CardsDue: number;
  TimeBlocksPlanned: number;
  LessonsCompleted: number;
  QuizzesTaken: number;
  QuizzesPassed: number;
  PerfectQuizzes: number;
  CoursesEnrolled: number;
  CoursesCompleted: number;
  DistractionsLogged: number;
  Streak: number;
}

export interface CourseSummary {
  Id: string;
  Title: string;
  Description: string | null;
  Category: string | null;
  Level: string | null;
  ImageUrl: string | null;
  InstructorId: string;
  InstructorName: string | null;
  Status: string;
  LessonsCount: number;
  EnrolledCount: number;
  IsFeatured: boolean;
  DurationHours: number | null;
}

export interface EnrollmentDto {
  Id: string;
  TrainerId: string;
  CourseId: string;
  EnrolledAt: string;
  ProgressPercentage: number;
  CompletedAt: string | null;
  Course: CourseSummary;
}

export interface StudySessionDto {
  Id: string;
  CourseId: string | null;
  LessonId: string | null;
  StartedAt: string;
  EndedAt: string | null;
  DurationSeconds: number;
}

export const trainerKeys = {
  stats: (userId?: string) => ['trainer-stats', userId] as const,
  activity: (userId?: string) => ['trainer-activity-summary', userId] as const,
  enrollments: (userId?: string) => ['enrollments-me', userId] as const,
  sessions: (userId?: string) => ['study-sessions', userId] as const,
};

export const useTrainerStatsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: trainerKeys.stats(user?.Id),
    queryFn: async () => (await api.get<TrainerData>('/Trainers/stats')).data,
    enabled: !!user,
  });
};

export const useActivitySummaryQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: trainerKeys.activity(user?.Id),
    queryFn: async () => (await api.get<ActivitySummary>('/Trainers/activity-summary')).data,
    enabled: !!user,
  });
};

export const useEnrollmentsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: trainerKeys.enrollments(user?.Id),
    queryFn: async () => (await api.get<EnrollmentDto[]>('/Enrollments/me')).data,
    enabled: !!user,
  });
};

export const useStudySessionsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: trainerKeys.sessions(user?.Id),
    queryFn: async () => (await api.get<StudySessionDto[]>('/study-sessions')).data,
    enabled: !!user,
  });
};
