import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import type { PricingDto } from './useBilling';

// Shared, typed react-query hooks for the trainer statistics endpoints.

export interface TrainerData {
  TotalStudyHours: number;
  AvgFocusScore: number;
  Streak: number;
  FlashcardsDue: number;
  WeakTopics: string[];
  /** Null = no data; otherwise Morning | Afternoon | Evening | Night. */
  BestStudyTime: string | null;
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

/** `CourseSummaryDto` — one row of `GET /api/Courses`. */
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
  /**
   * `Free | Subscription | AlaCarte`. Only `AlaCarte` *plus* a non-free `Pricing` gates anything; everything else is
   * the pre-monetization free course. Optional here because plenty of older fixtures and pickers build this shape
   * by hand.
   */
  AccessModel?: string | null;
  /** A trainer's self-enroll lands Pending until an organization/instructor approves it. */
  RequiresApproval?: boolean;
  /** The course price; null for every free course. */
  Pricing?: PricingDto | null;
  /** The caller holds an active entitlement covering this course (bought it, or bought a track that contains it). */
  Owned?: boolean;
  /** At least one chapter of this course is sold separately. */
  HasChapterPricing?: boolean;
  /** Free-text catalog tags. Optional: older fixtures build this shape by hand. */
  Tags?: string[];
  /** The department the course is filed under; null when unassigned. Optional: older fixtures build this shape by hand. */
  DepartmentId?: string | null;
  /** Ordered "what you'll learn" bullets. */
  Outcomes?: string[];
}

export interface EnrollmentDto {
  Id: string;
  TrainerId: string;
  CourseId: string;
  EnrolledAt: string;
  ProgressPercentage: number;
  CompletedAt: string | null;
  Course: CourseSummary;
  TrainerName?: string | null;
  CourseTitle?: string | null;
  InstructorName?: string | null;
}

export interface StudySessionDto {
  Id: string;
  CourseId: string | null;
  LessonId: string | null;
  CourseTitle?: string | null;
  LessonTitle?: string | null;
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
