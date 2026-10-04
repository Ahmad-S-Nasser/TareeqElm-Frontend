/**
 * Admin → Platform Courses (catalog v12 phase 3): authoring the courses the platform itself owns.
 *
 * `GET /api/Courses` already scopes to platform-owned courses for an Admin caller (`CourseService.VisibleTo`:
 * `OrganizationId == null`) — this file adds no filtering of its own, it just reuses the same endpoints the
 * instructor-facing course screens use (`POST/PUT/DELETE /api/Courses...`), plus the one new endpoint a platform
 * course alone has: `PUT /api/Courses/{id}/license-price`.
 *
 * No money is computed here: `LicensePrice.EffectiveAmount` comes back from the server, the form only sends the
 * amount a human typed (rounded to the currency's scale by `MoneyInput`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import type { CourseAccessModel, PricingDto, PricingWriteDto } from './useBilling';

/** A row of `GET /api/Courses` as the Platform Courses screen reads it (`CourseSummaryDto`). */
export interface AdminCourse {
  Id: string;
  Title: string;
  Description: string | null;
  Category: string | null;
  Level: string | null;
  ImageUrl: string | null;
  Status: 'Draft' | 'Published' | 'Archived';
  LessonsCount: number;
  EnrolledCount: number;
  AccessModel: CourseAccessModel;
  Pricing: PricingDto | null;
  /** Null for a platform course — every row this screen lists has one, but the field still mirrors the DTO. */
  OrganizationId: string | null;
  OrganizationName: string | null;
  /** What an organization pays once to add this course to its own library; null until Admin prices it for licensing. */
  LicensePrice: PricingDto | null;
}

export interface AdminCourseFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

const adminCoursesKeys = {
  all: ['admin-courses'] as const,
  list: (filters: AdminCourseFilters) => [...adminCoursesKeys.all, 'list', filters] as const,
};

export const ADMIN_COURSES_PAGE_SIZE = 100;

/** `GET /api/Courses?status=&search=&page=&pageSize=` — already scoped to platform-owned courses for Admin. */
export const useAdminCoursesQuery = (filters: AdminCourseFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: adminCoursesKeys.list(filters),
    queryFn: async () =>
      (
        await api.get<AdminCourse[]>('/Courses', {
          params: {
            search: filters.search?.trim() || undefined,
            status: filters.status || undefined,
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? ADMIN_COURSES_PAGE_SIZE,
          },
        })
      ).data,
    enabled: !!user,
  });
};

export interface PlatformCourseWriteDto {
  Title: string;
  Description?: string | null;
  Category?: string | null;
  Level?: string | null;
}

/** `POST /api/Courses` — the creating caller becomes `InstructorId`, so this naturally lands as a platform course. */
export const useCreatePlatformCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: PlatformCourseWriteDto) => (await api.post<AdminCourse>('/Courses', dto)).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminCoursesKeys.all }),
  });
};

/** `PUT /api/Courses/{id}` — title/description/category/level, or a status transition (Published/Archived). */
export const useUpdatePlatformCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<PlatformCourseWriteDto> & { Status?: string } }) =>
      (await api.put(`/Courses/${id}`, body)).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminCoursesKeys.all }),
  });
};

/** `DELETE /api/Courses/{id}`. */
export const useDeletePlatformCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/Courses/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminCoursesKeys.all }),
  });
};

/** `PUT /api/Courses/{id}/license-price` — Admin-only, and only on a platform course (enforced server-side). */
export const useSetCourseLicensePrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: PricingWriteDto }) => api.put(`/Courses/${id}/license-price`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminCoursesKeys.all }),
  });
};
