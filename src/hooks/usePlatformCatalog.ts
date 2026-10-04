/**
 * Organization → Platform Course Catalog (catalog v12 phase 3): browsing and licensing the platform's own courses.
 *
 * `GET /api/Organization/platform-courses` is deliberately not `GET /api/Courses` — that endpoint scopes an
 * Organization caller to its *own* courses, which never include a platform one. Licensing itself has no dedicated
 * endpoint at all: it is an ordinary `POST /api/checkout` with a `CourseLicense` line, so `useCreateCheckout`
 * (@/hooks/useCheckout) is reused as-is — the same manual/mock payment flow a trainee's purchase already goes through.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type PricingDto } from './useBilling';

/** A row of `GET /api/Organization/platform-courses` (`PlatformCourseDto`). */
export interface PlatformCourseDto {
  Id: string;
  Title: string;
  Description: string | null;
  Category: string | null;
  Level: string | null;
  ImageUrl: string | null;
  /** Null when Admin has not priced it for licensing yet — not licensable until it is. */
  LicensePrice: PricingDto | null;
  Licensed: boolean;
  LicensedAt: string | null;
}

export interface PlatformCourseFilters {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export const PLATFORM_COURSES_PAGE_SIZE = 20;

const platformCatalogKeys = {
  list: (filters: PlatformCourseFilters) => ['platform-courses', filters] as const,
};

export const usePlatformCoursesQuery = (filters: PlatformCourseFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: platformCatalogKeys.list(filters),
    queryFn: async () => {
      const res = await api.get<PlatformCourseDto[]>('/Organization/platform-courses', {
        params: {
          search: filters.search?.trim() || undefined,
          category: filters.category || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? PLATFORM_COURSES_PAGE_SIZE,
        },
      });
      const total = Number(res.headers['x-total-count'] ?? res.data.length);
      return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/** Invalidated after a successful license checkout so the catalog's `Licensed` flags refresh without a hard reload. */
export const useInvalidatePlatformCatalog = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['platform-courses'] });
    void queryClient.invalidateQueries({ queryKey: billingKeys.orders.all() });
  };
};
