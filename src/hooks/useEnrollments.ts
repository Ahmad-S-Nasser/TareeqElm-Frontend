import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** One row of GET /api/Enrollments (organization enrollment management, enrollments.manage). */
export interface EnrollmentRow {
  Id: string;
  TrainerId: string;
  /** Null when the trainer no longer exists. */
  TrainerName: string | null;
  CourseId: string;
  CourseTitle: string | null;
  /** Course owner's name; null when the instructor no longer exists. */
  InstructorName: string | null;
  SectionId: string | null;
  SectionName: string | null;
  /** Active | Pending | Waitlisted | Dropped | Rejected. */
  Status: string;
  /** Self | Admin | Bulk | Subscription | Purchase. */
  Source: string;
  EnrolledBy: string | null;
  EnrolledByName: string | null;
  EnrolledAt: string;
  ProgressPercentage: number;
  CompletedAt: string | null;
}

export interface EnrollmentFilters {
  courseId?: string;
  sectionId?: string;
  departmentId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface EnrollmentsPage {
  items: EnrollmentRow[];
  total: number;
}

export const enrollmentKeys = {
  list: (userId?: string, filters: EnrollmentFilters = {}) =>
    [
      'enrollments',
      userId,
      filters.courseId ?? '',
      filters.sectionId ?? '',
      filters.departmentId ?? '',
      filters.status ?? '',
      filters.search ?? '',
      filters.page ?? 1,
      filters.pageSize ?? 20,
    ] as const,
};

const fetchEnrollments = async (filters: EnrollmentFilters): Promise<EnrollmentsPage> => {
  const res = await api.get<EnrollmentRow[]>('/Enrollments', {
    params: {
      courseId: filters.courseId || undefined,
      sectionId: filters.sectionId || undefined,
      departmentId: filters.departmentId || undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
  });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total };
};

/** GET /api/Enrollments?courseId=&sectionId=&departmentId=&status=&search=&page=&pageSize= (enrollments.manage). */
export const useEnrollmentsQuery = (filters: EnrollmentFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: enrollmentKeys.list(user?.Id, filters),
    queryFn: () => fetchEnrollments(filters),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

const useInvalidateEnrollments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['enrollments', user?.Id] });
};

export interface BulkEnrollInput {
  courseId: string;
  sectionId?: string;
  /** Either this or departmentId must be given (trainerIds wins when both are supplied). */
  trainerIds?: string[];
  /** Enrolls every active Trainer in this department; ignored when trainerIds is non-empty. */
  departmentId?: string;
  /** Skip the course's prerequisite gate for this whole batch (an audited administrative override). */
  overridePrerequisites?: boolean;
}

export interface BulkEnrollRow {
  TrainerId: string;
  TrainerName: string | null;
  /** ok = enrolled Active; waitlisted = enrolled Waitlisted; conflict = already enrolled; full = could not be enrolled;
   *  prerequisite = the trainer has not completed every prerequisite course (and the batch did not override it). */
  Status: 'ok' | 'conflict' | 'waitlisted' | 'full' | 'prerequisite';
  EnrollmentId: string | null;
}

export interface BulkEnrollResult {
  Rows: BulkEnrollRow[];
  OkCount: number;
  ConflictCount: number;
  WaitlistedCount: number;
  FullCount: number;
  /** Rows refused by the prerequisite gate. Optional: older servers do not send it. */
  PrerequisiteCount?: number;
}

/** POST /api/Enrollments/bulk. */
export const useBulkEnroll = () => {
  const invalidate = useInvalidateEnrollments();
  return useMutation({
    mutationFn: async (input: BulkEnrollInput) =>
      (
        await api.post<BulkEnrollResult>('/Enrollments/bulk', {
          CourseId: input.courseId,
          SectionId: input.sectionId || undefined,
          TrainerIds: input.trainerIds && input.trainerIds.length > 0 ? input.trainerIds : undefined,
          DepartmentId: input.departmentId || undefined,
          OverridePrerequisites: input.overridePrerequisites || undefined,
        })
      ).data,
    onSuccess: invalidate,
  });
};

/** POST /api/Enrollments/{id}/approve: Pending -> Active (or Waitlisted if the section filled up meanwhile). */
export const useApproveEnrollment = () => {
  const invalidate = useInvalidateEnrollments();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<EnrollmentRow>(`/Enrollments/${id}/approve`)).data,
    onSuccess: invalidate,
  });
};

/** POST /api/Enrollments/{id}/reject: Pending/Waitlisted/Active -> Rejected. */
export const useRejectEnrollment = () => {
  const invalidate = useInvalidateEnrollments();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<EnrollmentRow>(`/Enrollments/${id}/reject`)).data,
    onSuccess: invalidate,
  });
};

/** DELETE /api/Enrollments/{id}: unenroll (Active/Pending/Waitlisted -> Dropped). */
export const useUnenrollTrainer = () => {
  const invalidate = useInvalidateEnrollments();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Enrollments/${id}`);
    },
    onSuccess: invalidate,
  });
};
