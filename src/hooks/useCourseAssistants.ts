/**
 * Human teaching assistants of one course (phase 4 of the certificates/academic-structure project).
 *
 *   GET    /api/courses/{courseId}/assistants             signed-in; the server answers only the course's own
 *                                                         instructor, its organization, or Admin
 *   GET    /api/courses/{courseId}/assistants/candidates  course-assistants.manage — the org's other active instructors
 *   POST   /api/courses/{courseId}/assistants             course-assistants.manage — 400 course_assistant.not_instructor /
 *                                                         course_assistant.is_course_instructor, 409 course_assistant.already_assigned
 *   PUT    /api/courses/{courseId}/assistants/{id}        course-assistants.manage — replaces the three capability flags
 *   DELETE /api/courses/{courseId}/assistants/{id}        course-assistants.manage
 *
 * Each capability is granted on its own: a TA with only `CanGrade` can grade submissions and read quiz results but can
 * neither mark attendance nor post announcements. Authoring (the course, its assignments and quizzes) is never a TA power.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface CourseAssistantCapabilities {
  CanGrade: boolean;
  CanManageAttendance: boolean;
  CanMessage: boolean;
}

/** `CourseAssistantDto`. */
export interface CourseAssistant extends CourseAssistantCapabilities {
  Id: string;
  CourseId: string;
  UserId: string;
  Name: string | null;
  Email: string | null;
  AssignedBy: string;
  AssignedByName: string | null;
  AssignedAt: string;
}

/** `CourseAssistantCandidateDto` — an instructor of the course's organization who can still be assigned. */
export interface CourseAssistantCandidate {
  UserId: string;
  Name: string;
  Email: string;
}

export type CourseAssistantCapability = keyof CourseAssistantCapabilities;
export const COURSE_ASSISTANT_CAPABILITIES: CourseAssistantCapability[] = ['CanGrade', 'CanManageAttendance', 'CanMessage'];

/** The error codes the assign endpoint answers with; the UI has its own copy of each. */
export const COURSE_ASSISTANT_ERROR_CODES = [
  'course_assistant.not_instructor',
  'course_assistant.is_course_instructor',
  'course_assistant.already_assigned',
  'course_assistant.not_found',
] as const;

export const courseAssistantKeys = {
  all: ['course-assistants'] as const,
  list: (courseId?: string) => ['course-assistants', courseId, 'list'] as const,
  candidates: (courseId?: string) => ['course-assistants', courseId, 'candidates'] as const,
};

const base = (courseId: string) => `/courses/${encodeURIComponent(courseId)}/assistants`;

/** `GET /api/courses/{courseId}/assistants`. */
export const useCourseAssistantsQuery = (courseId?: string) =>
  useQuery({
    queryKey: courseAssistantKeys.list(courseId),
    queryFn: async () => (await api.get<CourseAssistant[]>(base(courseId!))).data,
    enabled: !!courseId,
  });

/** `GET /api/courses/{courseId}/assistants/candidates` — only fetched while the add-assistant picker is open. */
export const useCourseAssistantCandidatesQuery = (courseId?: string, enabled = true) =>
  useQuery({
    queryKey: courseAssistantKeys.candidates(courseId),
    queryFn: async () => (await api.get<CourseAssistantCandidate[]>(`${base(courseId!)}/candidates`)).data,
    enabled: !!courseId && enabled,
  });

const useInvalidate = (courseId: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['course-assistants', courseId] });
};

/** `POST /api/courses/{courseId}/assistants`. */
export const useAssignCourseAssistant = (courseId: string) => {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: async (body: { UserId: string } & CourseAssistantCapabilities) =>
      (await api.post<CourseAssistant>(base(courseId), body)).data,
    onSuccess: invalidate,
  });
};

/** `PUT /api/courses/{courseId}/assistants/{id}` — all three flags travel together. */
export const useUpdateCourseAssistant = (courseId: string) => {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: async ({ id, ...flags }: { id: string } & CourseAssistantCapabilities) =>
      (await api.put<CourseAssistant>(`${base(courseId)}/${encodeURIComponent(id)}`, flags)).data,
    onSuccess: invalidate,
  });
};

/** `DELETE /api/courses/{courseId}/assistants/{id}`. */
export const useRemoveCourseAssistant = (courseId: string) => {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${base(courseId)}/${encodeURIComponent(id)}`);
      return id;
    },
    onSuccess: invalidate,
  });
};
