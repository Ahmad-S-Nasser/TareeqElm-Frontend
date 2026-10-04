/**
 * Catalog pricing writes (phase 5, wave F1c).
 *
 * Pricing authority belongs to **Organization/Admin**, never to the course's instructor: every mutation here is behind
 * `pricing.manage` server-side (`[HasPermission(Permissions.PricingManage)]` on `CoursesController`) and behind
 * `<Can permission={PERMISSIONS.pricingManage}>` in the UI. There is deliberately no instructor-facing price control
 * anywhere in this product — an instructor only ever *views* what they earned (see `./useEarnings.ts`).
 *
 * Two endpoints, both 204 on success:
 *   PUT /api/Courses/{id}/pricing                              — price + access model together
 *   PUT /api/Courses/{courseId}/chapters/{chapterId}/pricing   — 400 `pricing.not_allowed` unless the course is à-la-carte
 *
 * No money is computed here. The client sends the amounts a human typed (rounded to the currency's scale by
 * `MoneyInput`/`roundMoney`) and reads back whatever `PricingDto.EffectiveAmount` the server decided.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import type { ChapterPricingWriteDto, CourseAccessModel, PricingDto, PricingWriteDto } from './useBilling';

/**
 * A row of `GET /api/Courses` as the pricing screen reads it (`CourseSummaryDto`). Titles come resolved from the
 * server — the page never renders a raw id.
 */
export interface PricedCourse {
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
  /** Free | Subscription | AlaCarte. Only `AlaCarte` + a paid `Pricing` actually gates content. */
  AccessModel: CourseAccessModel;
  RequiresApproval: boolean;
  /** Null on every free course (which is every course that predates phase 5). */
  Pricing: PricingDto | null;
  Owned: boolean;
  /** At least one chapter of this course is sold separately. */
  HasChapterPricing: boolean;
}

/** A chapter of `GET /api/Courses/{id}/curriculum` (`ChapterDto`), with the two fields the pricing drawer edits. */
export interface PricedChapter {
  Id: string | null;
  Title: string;
  Description: string | null;
  OrderIndex: number;
  Lessons: { Id: string | null; Title: string }[];
  /** Per-chapter price, when this chapter is sold separately; null = not sold separately. */
  Pricing: PricingDto | null;
  /** A free sample chapter: readable on a paid course without buying anything. */
  IsPreview: boolean;
}

/** Filters for the catalog list the pricing screen shows. */
export interface CatalogFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Query keys for the pricing screens. They intentionally start with `'billing'`, the prefix `billingKeys.all` uses, so
 * `queryClient.invalidateQueries({ queryKey: billingKeys.all })` — what every money mutation in this phase does —
 * refreshes these caches too.
 */
export const pricingKeys = {
  all: () => ['billing', 'pricing'] as const,
  catalog: (filters: CatalogFilters = {}) =>
    [
      'billing',
      'pricing',
      'catalog',
      filters.search ?? '',
      filters.status ?? '',
      filters.page ?? 1,
      filters.pageSize ?? 100,
    ] as const,
  chapters: (courseId?: string | null) => ['billing', 'pricing', 'chapters', courseId ?? ''] as const,
};

/** `GET /api/Courses` — the catalog the pricing screen prices. Any signed-in caller may read it. */
export const useCatalogCoursesQuery = (filters: CatalogFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: pricingKeys.catalog(filters),
    queryFn: async () =>
      (
        await api.get<PricedCourse[]>('/Courses', {
          params: {
            search: filters.search?.trim() || undefined,
            status: filters.status || undefined,
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? 100,
          },
        })
      ).data,
    enabled: !!user,
  });
};

/** `GET /api/Courses/{id}/curriculum` — the chapters of one course, for the per-chapter pricing drawer. */
export const useCourseChaptersQuery = (courseId: string | null) =>
  useQuery({
    queryKey: pricingKeys.chapters(courseId),
    queryFn: async () => (await api.get<PricedChapter[]>(`/Courses/${courseId}/curriculum`)).data,
    enabled: !!courseId,
  });

/** Everything a price write touches: the catalog, the chapter drawer, and every other billing cache. */
const useInvalidatePricing = () => {
  const queryClient = useQueryClient();
  // `billingKeys.all` is ['billing'], the prefix of pricingKeys too — one invalidation covers both.
  return () => queryClient.invalidateQueries({ queryKey: ['billing'] });
};

/** `PUT /api/Courses/{id}/pricing` (pricing.manage). 204 on success; the caller re-reads the price from the catalog. */
export const useSetCoursePricing = () => {
  const invalidate = useInvalidatePricing();
  return useMutation({
    mutationFn: async ({ courseId, body }: { courseId: string; body: PricingWriteDto }) => {
      await api.put(`/Courses/${courseId}/pricing`, body);
    },
    onSuccess: invalidate,
  });
};

/**
 * `PUT /api/Courses/{courseId}/chapters/{chapterId}/pricing` (pricing.manage).
 * 400 `pricing.not_allowed` when the course is not à-la-carte — the UI hides the control in that case, but the server
 * is the one that decides.
 */
export const useSetChapterPricing = () => {
  const invalidate = useInvalidatePricing();
  return useMutation({
    mutationFn: async ({
      courseId,
      chapterId,
      body,
    }: {
      courseId: string;
      chapterId: string;
      body: ChapterPricingWriteDto;
    }) => {
      await api.put(`/Courses/${courseId}/chapters/${chapterId}/pricing`, body);
    },
    onSuccess: invalidate,
  });
};
