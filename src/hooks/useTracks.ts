/**
 * Learning tracks (phase 5, wave F3a) — an ordered bundle of courses sold as one item.
 *
 * Seven endpoints, and **two different permissions guard them**:
 *   GET    /api/tracks?status=&search=&page=&pageSize=   [Authorize]      total in X-Total-Count
 *   GET    /api/tracks/{id}                              [Authorize]      TrackDetailDto (+ ordered Courses)
 *   POST   /api/tracks                                   tracks.manage    201 + the created track
 *   PUT    /api/tracks/{id}                              tracks.manage    204
 *   PUT    /api/tracks/{id}/courses                      tracks.manage    204 — the complete ordered list
 *   PUT    /api/tracks/{id}/pricing                      **pricing.manage**  204
 *   DELETE /api/tracks/{id}                              tracks.manage    204, or 409 `track.in_use`
 *
 * `tracks.manage` (who may build a path) and `pricing.manage` (who may put a price on it) are deliberately separate
 * decisions on the backend — `TracksController.SetPricing` is the one action on that controller carrying
 * `[HasPermission(Permissions.PricingManage)]`. The UI must gate each control by its own permission rather than
 * lumping them together, or it will offer a button the server then refuses.
 *
 * **`PUT /{id}/courses` is both "reorder" and "replace".** The server stores the list verbatim (de-duplicated, order
 * preserved) and access follows the track's *current* course list, so adding a course grants it to everyone who
 * already bought the bundle. There is no per-course add/remove endpoint by design.
 *
 * **A bought track is never deleted out from under its buyer:** `DELETE` answers 409 `track.in_use` while any active
 * entitlement references it. That is a rule, not a failure — `isTrackInUseError` exists so a caller can say
 * "archive it instead" rather than showing a generic error.
 *
 * No money is computed here: amounts go out exactly as typed into `MoneyInput` and come back as a server-computed
 * `PricingDto`.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import {
  billingKeys,
  type CourseAccessModel,
  type PricingDto,
  type PricingWriteDto,
  type TrackFilters,
  type TrackStatus,
} from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/TrackDtos.cs)
// ---------------------------------------------------------------------------

/** `TrackCourseDto` — one course inside a track's ordered list, with its resolved title and instructor name. */
export interface TrackCourse {
  Id: string;
  /** Null when the course was deleted after it was added to the track; the UI shows its own placeholder. */
  Title: string | null;
  InstructorId: string | null;
  InstructorName: string | null;
  Status: string | null;
  AccessModel: CourseAccessModel | null;
  Pricing: PricingDto | null;
  /** The *caller* already has access to this course — not a count of buyers. */
  Owned: boolean;
  /** Position in the track, starting at 0. */
  Order: number;
}

/** `TrackSummaryDto` — one row of `GET /api/tracks`. */
export interface TrackSummary {
  Id: string;
  Title: string;
  Description: string | null;
  ImageUrl: string | null;
  Status: TrackStatus;
  CoursesCount: number;
  Pricing: PricingDto | null;
  IsFeatured: boolean;
  EstimatedHours: number | null;
  DepartmentId: string | null;
  /** Resolved server-side; null when the department is gone. The id is never rendered. */
  DepartmentName: string | null;
  OwnerInstructorId: string | null;
  OwnerInstructorName: string | null;
  /** The caller holds an active entitlement for this track. */
  Owned: boolean;
  CreatedAt: string;
  /** The track certificate also needs a pass on the capstone `CertificateExamQuizId`. */
  CertificateRequiresExam?: boolean;
  /** A quiz of one of the track's own courses (the capstone exam). */
  CertificateExamQuizId?: string | null;
}

/** `TrackDetailDto` — a summary plus the ordered course list. */
export interface TrackDetail extends TrackSummary {
  Courses: TrackCourse[];
}

/**
 * `TrackWriteDto` — the create/update body. `Title` is required on **both** (an update with no title is rejected as
 * `track.invalid`); every other field omitted means "leave it alone" on an update. Pricing is not part of this body.
 */
export interface TrackWrite {
  Title: string;
  Description?: string | null;
  ImageUrl?: string | null;
  /** Draft | Published | Archived. Omitted = Draft on create, unchanged on update. */
  Status?: TrackStatus | null;
  /** The ordered course list. Omitted on an update = leave the current list alone. */
  CourseIds?: string[] | null;
  IsFeatured?: boolean | null;
  EstimatedHours?: number | null;
  DepartmentId?: string | null;
}

/** Body of `PUT /api/tracks/{id}/pricing` — `PricingUpdateDto`, i.e. a course price write without an access model. */
export type TrackPricingWrite = Omit<PricingWriteDto, 'AccessModel'>;

/** A page of tracks plus the server's total, read from `X-Total-Count`. */
export interface TracksPage {
  items: TrackSummary[];
  total: number;
}

export const TRACKS_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// The one conflict that is a rule, not a failure
// ---------------------------------------------------------------------------

/** The error code `DELETE /api/tracks/{id}` answers with while somebody still owns the track. */
export const TRACK_IN_USE = 'track.in_use';

/**
 * True when a failed delete means "somebody bought this bundle", so the caller can offer *archive it instead* rather
 * than a generic "could not delete". The code is read when the body carries one; a bare 409 from this route can only
 * ever be this rule (`TracksController.Fail` defaults its conflict code to `track.in_use`).
 */
export const isTrackInUseError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return false;
  const data: unknown = error.response.data;
  if (typeof data === 'object' && data !== null && typeof (data as { code?: unknown }).code === 'string') {
    return (data as { code: string }).code === TRACK_IN_USE;
  }
  return true;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const totalOf = (headers: Record<string, unknown>, fallback: number) => {
  const total = Number(headers['x-total-count'] ?? fallback);
  return Number.isFinite(total) ? total : fallback;
};

/**
 * `GET /api/tracks` — readable by any signed-in caller; a caller who cannot see everything only ever gets Published
 * tracks, so the status filter is a *narrowing*, never a way to see more.
 */
export const useTracksQuery = (filters: TrackFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.tracks.list(filters),
    queryFn: async (): Promise<TracksPage> => {
      const res = await api.get<TrackSummary[]>('/tracks', {
        params: {
          status: filters.status || undefined,
          search: filters.search?.trim() || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? TRACKS_PAGE_SIZE,
        },
      });
      return { items: res.data, total: totalOf(res.headers, res.data.length) };
    },
    enabled: !!user,
    // Paging or re-searching should not blink the table back to a spinner.
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/tracks/{id}` — the track plus its ordered courses, with titles and instructor names already resolved. */
export const useTrackQuery = (trackId?: string | null) =>
  useQuery({
    queryKey: billingKeys.tracks.detail(trackId ?? undefined),
    queryFn: async () => (await api.get<TrackDetail>(`/tracks/${trackId}`)).data,
    enabled: !!trackId,
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Everything a track write touches. `billingKeys.all` is `['billing']`, the prefix of both the track keys and
 * `pricingKeys`, so one call also refreshes the course catalog — a track's price changes the "buy the whole path"
 * banner a course detail shows.
 */
const useInvalidateTracks = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: billingKeys.all });
};

/** `POST /api/tracks` (tracks.manage) — 201 with the created `TrackDetailDto`. */
export const useCreateTrack = () => {
  const invalidate = useInvalidateTracks();
  return useMutation({
    mutationFn: async (body: TrackWrite) => (await api.post<TrackDetail>('/tracks', body)).data,
    onSuccess: invalidate,
  });
};

/** `PUT /api/tracks/{id}` (tracks.manage) — 204. `Title` must always be sent, even when it has not changed. */
export const useUpdateTrack = () => {
  const invalidate = useInvalidateTracks();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: TrackWrite }) => {
      await api.put(`/tracks/${id}`, body);
      return id;
    },
    onSuccess: invalidate,
  });
};

/**
 * `PUT /api/tracks/{id}/courses` (tracks.manage) — the **complete ordered list**, so this is how a course is added,
 * removed *and* reordered. Everyone who already bought the track gains or loses access immediately.
 */
export const useSetTrackCourses = () => {
  const invalidate = useInvalidateTracks();
  return useMutation({
    mutationFn: async ({ id, courseIds }: { id: string; courseIds: string[] }) => {
      await api.put(`/tracks/${id}/courses`, { CourseIds: courseIds });
      return id;
    },
    onSuccess: invalidate,
  });
};

/**
 * `PUT /api/tracks/{id}/pricing` — **`pricing.manage`**, not `tracks.manage`. The body is a `PricingUpdateDto`: a
 * track has no access model, only a price (or none at all, with `IsFree`).
 */
export const useSetTrackPricing = () => {
  const invalidate = useInvalidateTracks();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: TrackPricingWrite }) => {
      await api.put(`/tracks/${id}/pricing`, body);
      return id;
    },
    onSuccess: invalidate,
  });
};

/**
 * `DELETE /api/tracks/{id}` (tracks.manage) — 204, or **409 `track.in_use`** when an active entitlement still points
 * at it. The rejection is passed through unchanged so the caller can recognise it with `isTrackInUseError` and say
 * "archive it instead"; nothing is swallowed here.
 */
export const useDeleteTrack = () => {
  const invalidate = useInvalidateTracks();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tracks/${id}`);
      return id;
    },
    onSuccess: invalidate,
  });
};
