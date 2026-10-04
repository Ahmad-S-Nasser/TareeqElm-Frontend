/**
 * The instructor activity report (Phase 5).
 *
 *   GET /api/organization/reports/instructor-activity?from=&to=&instructorId=   (reports.view)
 *
 * The server scopes the report to the caller's organization itself — no organization id is ever sent. Like the Phase 4
 * reports (see `usePerformanceReports.ts`), the query takes an explicit `enabled` flag and a `runId`: a report page runs
 * only after "Generate report" is clicked (see `useReportBuilder`), and clicking it again with unchanged filters re-fetches.
 *
 * There is deliberately no ratings/reviews dimension: the platform records no such data.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/InstructorActivityReportDtos.cs)
// ---------------------------------------------------------------------------

/** `InstructorActivityRowDto` — one instructor's activity in the window. */
export interface InstructorActivityRow {
  InstructorId: string;
  /** Null once the user no longer resolves; never render the id instead. */
  InstructorName: string | null;
  /** Sessions led that started in the window (and have already started); cancelled ones excluded. */
  SessionsTaught: number;
  /** 0..1 with four decimals — NOT a percentage. Null when there was nothing to measure: render "—", never "0%". */
  AttendanceRate: number | null;
  /** Content library uploads in the window. */
  ContentUploads: number;
  /** Published courses taught right now (ignores the window). */
  ActiveCourses: number;
  /** Active, not-yet-completed enrollments in those courses right now (ignores the window). */
  ActiveEnrollments: number;
}

export interface InstructorActivityReport {
  /** One row per instructor in scope, most sessions taught first. */
  Rows: InstructorActivityRow[];
}

// ---------------------------------------------------------------------------
// Filters and keys
// ---------------------------------------------------------------------------

/** What the report form edits. Blank means "any"; dates are bare `yyyy-MM-dd` (a bare `to` covers that whole day). */
export interface InstructorActivityFilters {
  from?: string;
  to?: string;
  instructorId?: string;
}

/** A window is only worth sending when it is not backwards (either end may be open). */
export const isValidInstructorActivityRange = (filters: InstructorActivityFilters): boolean =>
  !filters.from || !filters.to || filters.from <= filters.to;

export const instructorActivityReportKeys = {
  all: ['organization-reports', 'instructor-activity'] as const,
  report: (filters: InstructorActivityFilters, runId: number) =>
    [
      ...instructorActivityReportKeys.all,
      filters.from ?? '',
      filters.to ?? '',
      filters.instructorId ?? '',
      runId,
    ] as const,
};

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * `GET /api/organization/reports/instructor-activity`. `enabled` is the page's "has Generate been clicked" flag; `runId`
 * (from `useReportBuilder`) is in the key so clicking Generate again with the same filters still re-fetches.
 */
export const useInstructorActivityReportQuery = (filters: InstructorActivityFilters, enabled: boolean, runId = 0) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: instructorActivityReportKeys.report(filters, runId),
    queryFn: async () =>
      (
        await api.get<InstructorActivityReport>('/organization/reports/instructor-activity', {
          params: {
            from: filters.from || undefined,
            to: filters.to || undefined,
            instructorId: filters.instructorId || undefined,
          },
        })
      ).data,
    enabled: !!user && enabled && isValidInstructorActivityRange(filters),
  });
};
