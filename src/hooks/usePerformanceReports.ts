/**
 * The trainee performance and course completion reports (Phase 4).
 *
 *   GET /api/organization/reports/trainee-performance?from=&to=&courseId=&departmentId=&page=&pageSize=   (reports.view)
 *   GET /api/organization/reports/course-completion?from=&to=&courseId=&departmentId=                     (reports.view)
 *
 * Both are aggregations the server runs inside MongoDB and scopes to the caller's organization itself — nothing here adds
 * numbers up, and no organization id is ever sent. Both queries take an explicit `enabled` flag: a report page runs only
 * after "Generate report" is clicked (see `useReportBuilder`), so the page passes `hasGenerated` straight through.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** The permission both endpoints (and both pages) require. Organization by default; Admin holds it automatically. */
export const REPORTS_VIEW = 'reports.view';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/PerformanceReportDtos.cs)
// ---------------------------------------------------------------------------

/** `ScoreBucketDto` — one band of the grade distribution; both bounds inclusive, whole-number percentages. */
export interface ScoreBucket {
  /** "0-59" | "60-69" | "70-79" | "80-89" | "90-100" */
  Label: string;
  Min: number;
  Max: number;
  Count: number;
}

/** `CourseQuizPerformanceDto` — one course's attempts in the window. */
export interface CourseQuizPerformance {
  CourseId: string;
  /** Null once the course has been deleted; never render the id instead. */
  CourseTitle: string | null;
  AttemptCount: number;
  PassCount: number;
  /** 0..1 with four decimals — NOT a percentage. */
  PassRate: number;
  /** 0..100, one decimal. */
  AverageScore: number;
}

export interface TraineePerformanceSummary {
  AttemptCount: number;
  PassCount: number;
  /** 0..1 with four decimals — NOT a percentage. */
  PassRate: number;
  /** 0..100, one decimal. */
  AverageScore: number;
  /** Always all five bands, lowest first. */
  DistributionBuckets: ScoreBucket[];
  Courses: CourseQuizPerformance[];
}

/** `TraineePerformanceRowDto` — one quiz attempt in the drill-down table. */
export interface TraineePerformanceRow {
  ResultId: string;
  TrainerId: string;
  TrainerName: string | null;
  CourseId: string;
  CourseTitle: string | null;
  QuizId: string;
  QuizTitle: string | null;
  /** 0..100 */
  Percentage: number;
  Passed: boolean;
  TakenAt: string;
}

export interface TraineePerformanceReport {
  Summary: TraineePerformanceSummary;
  /** Newest first; `Total` is every attempt in the window, not just this page. */
  Rows: { Items: TraineePerformanceRow[]; Total: number };
  Page: number;
  PageSize: number;
}

/** `CourseCompletionRowDto` — one course's enrollments in the window. */
export interface CourseCompletionRow {
  CourseId: string;
  CourseTitle: string | null;
  EnrollmentCount: number;
  CompletedCount: number;
  DroppedCount: number;
  /** 0..1 */
  CompletionRate: number;
  /** Days, one decimal; null when nobody in the window has completed yet. */
  AverageDaysToComplete: number | null;
  /** 0..1 */
  DropoutRate: number;
}

export interface CourseCompletionReport {
  EnrollmentCount: number;
  CompletedCount: number;
  DroppedCount: number;
  /** 0..1, weighted by enrollments across every course. */
  CompletionRate: number;
  AverageDaysToComplete: number | null;
  DropoutRate: number;
  Rows: CourseCompletionRow[];
}

// ---------------------------------------------------------------------------
// Filters and keys
// ---------------------------------------------------------------------------

/** What both report forms edit. Blank means "any"; dates are bare `yyyy-MM-dd` (a bare `to` covers that whole day). */
export interface PerformanceReportFilters {
  from?: string;
  to?: string;
  courseId?: string;
  departmentId?: string;
}

export interface TraineePerformanceFilters extends PerformanceReportFilters {
  page?: number;
  pageSize?: number;
}

export const TRAINEE_PERFORMANCE_PAGE_SIZE = 20;

/** The five score bands, lowest first — the same labels the server sends, used to key translations. */
export const SCORE_BUCKET_LABELS = ['0-59', '60-69', '70-79', '80-89', '90-100'] as const;

/** A window is only worth sending when it is not backwards (either end may be open). */
export const isValidReportRange = (filters: PerformanceReportFilters): boolean =>
  !filters.from || !filters.to || filters.from <= filters.to;

const baseParams = (filters: PerformanceReportFilters) => ({
  from: filters.from || undefined,
  to: filters.to || undefined,
  courseId: filters.courseId || undefined,
  departmentId: filters.departmentId || undefined,
});

export const performanceReportKeys = {
  all: ['organization-reports', 'performance'] as const,
  trainee: (filters: TraineePerformanceFilters, runId: number) =>
    [
      ...performanceReportKeys.all,
      'trainee',
      filters.from ?? '',
      filters.to ?? '',
      filters.courseId ?? '',
      filters.departmentId ?? '',
      filters.page ?? 1,
      filters.pageSize ?? TRAINEE_PERFORMANCE_PAGE_SIZE,
      runId,
    ] as const,
  completion: (filters: PerformanceReportFilters, runId: number) =>
    [
      ...performanceReportKeys.all,
      'completion',
      filters.from ?? '',
      filters.to ?? '',
      filters.courseId ?? '',
      filters.departmentId ?? '',
      runId,
    ] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * `GET /api/organization/reports/trainee-performance`. `enabled` is the page's "has Generate been clicked" flag; `runId`
 * (from `useReportBuilder`) is in the key so clicking Generate again with the same filters still re-fetches. Paging keeps
 * the previous page on screen while the next one loads.
 */
export const useTraineePerformanceReportQuery = (filters: TraineePerformanceFilters, enabled: boolean, runId = 0) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: performanceReportKeys.trainee(filters, runId),
    queryFn: async () =>
      (
        await api.get<TraineePerformanceReport>('/organization/reports/trainee-performance', {
          params: {
            ...baseParams(filters),
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? TRAINEE_PERFORMANCE_PAGE_SIZE,
          },
        })
      ).data,
    enabled: !!user && enabled && isValidReportRange(filters),
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/organization/reports/course-completion`. Same `enabled`/`runId` contract as the trainee report. */
export const useCourseCompletionReportQuery = (filters: PerformanceReportFilters, enabled: boolean, runId = 0) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: performanceReportKeys.completion(filters, runId),
    queryFn: async () =>
      (await api.get<CourseCompletionReport>('/organization/reports/course-completion', { params: baseParams(filters) })).data,
    enabled: !!user && enabled && isValidReportRange(filters),
  });
};
