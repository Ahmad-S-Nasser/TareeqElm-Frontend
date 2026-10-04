/**
 * The Department Analytics report (reports plan, Phase 3).
 *
 *   GET /api/Organization/departments?from=&to=   (organization.view)
 *
 * The same endpoint the old always-on charts on the Reports page used; `from`/`to` (optional, bare dates, `to` inclusive
 * of its whole day) narrow each department's performance figure to enrollments made in that window. Course and trainee
 * counts are structural and ignore the window.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** `DepartmentSummaryDto`. */
export interface DepartmentSummary {
  Id: string;
  Name: string;
  Head: string | null;
  CoursesCount: number;
  TrainersCount: number;
  /** Average enrollment progress (0-100) in the department's courses, over the requested window. */
  Performance: number;
  Trend: number;
}

export interface DepartmentAnalyticsFilters {
  from?: string;
  to?: string;
}

export const departmentAnalyticsKeys = {
  all: ['organization', 'reports', 'department-analytics'] as const,
  report: (filters: DepartmentAnalyticsFilters, runId = 0) =>
    [...departmentAnalyticsKeys.all, filters.from ?? '', filters.to ?? '', runId] as const,
};

export const fetchDepartmentAnalytics = async (filters: DepartmentAnalyticsFilters): Promise<DepartmentSummary[]> => {
  const res = await api.get<DepartmentSummary[]>('/Organization/departments', {
    params: { from: filters.from || undefined, to: filters.to || undefined },
  });
  return Array.isArray(res.data) ? res.data : [];
};

/** Idle until `enabled` (the report page's `hasGenerated`); `runId` makes a repeated Generate re-fire the request. */
export const useDepartmentAnalyticsQuery = (
  filters: DepartmentAnalyticsFilters | null,
  options: { enabled: boolean; runId?: number }
) => {
  const { user } = useAuth();
  const applied = filters ?? {};
  return useQuery({
    queryKey: departmentAnalyticsKeys.report(applied, options.runId ?? 0),
    queryFn: () => fetchDepartmentAnalytics(applied),
    enabled: !!user && options.enabled && filters !== null,
    placeholderData: keepPreviousData,
  });
};
