/**
 * Departments as seen by the course pages and the Organization "Departments" page.
 *
 *   GET /api/Courses/departments        any signed-in user — [{ Id, Name }] of the caller's own organization (Admin: all).
 *                                       Feeds the course create/edit Department picker (instructors do not hold
 *                                       departments.manage) and the catalogs' Department filter.
 *   GET /api/Courses?departmentId=      the course list narrowed to one department (CourseQuery.DepartmentId).
 *   PUT /api/Departments/{id}/assign    departments.manage — bulk-files users and courses under one department:
 *                                       { UserIds: string[], CourseIds: string[] }, 204.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** `CourseDepartmentOptionDto`. */
export interface DepartmentOption {
  Id: string;
  Name: string;
}

/** Select sentinel for "no department" (a Radix SelectItem cannot carry an empty value) — the OrganizationTrainers convention. */
export const NO_DEPARTMENT = 'none';
/** Select sentinel for "every department" in a filter. */
export const ALL_DEPARTMENTS = 'all';

export const courseDepartmentOptionsKey = ['course-department-options'] as const;

/** The departments a course can be filed under / a catalog can be filtered by. */
export const useCourseDepartmentOptions = () =>
  useQuery({
    queryKey: courseDepartmentOptionsKey,
    queryFn: async () => (await api.get<DepartmentOption[]>('/Courses/departments')).data,
    staleTime: 60_000,
  });

/** `DepartmentAssignDto`. */
export interface DepartmentAssignment {
  UserIds: string[];
  CourseIds: string[];
}

/** Files the given users and courses under one department (a user/course already in another department is moved). */
export const useAssignDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ departmentId, assignment }: { departmentId: string; assignment: DepartmentAssignment }) => {
      await api.put(`/Departments/${departmentId}/assign`, assignment);
    },
    onSuccess: () => {
      // Department cards' CoursesCount/TrainersCount, the dashboard, and every list that shows or filters by department.
      queryClient.invalidateQueries({ queryKey: ['organization-departments'] });
      queryClient.invalidateQueries({ queryKey: ['organization-stats'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['organization-trainers'] });
      queryClient.invalidateQueries({ queryKey: ['organization-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-catalog'] });
    },
  });
};
