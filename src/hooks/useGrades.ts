/**
 * Grades (classes) of a School-kind organization.
 *
 *   GET    /api/grades?academicYearId=   -> GradeDto[] (any signed-in user, scoped to their tenant)
 *   POST   /api/grades                   { Name, AcademicYearId?, HomeroomInstructorId?, MemberTrainerIds?, Capacity?, CourseIds? }
 *   PUT    /api/grades/{id}              same body (a full replacement: omitted lists become empty)
 *   DELETE /api/grades/{id}              -> 204
 *
 * Writes need `academic-structure.manage` and answer 403 `academic_structure.not_enabled` for a non-School organization.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { academicYearKeys } from './useAcademicYears';

/** `GradeDto` (mirror of Nafea.Application/DTOs/GradeDtos.cs). Resolved names are null when the target no longer exists. */
export interface Grade {
  Id: string;
  Name: string;
  AcademicYearId: string | null;
  AcademicYearName: string | null;
  HomeroomInstructorId: string | null;
  HomeroomInstructorName: string | null;
  MemberTrainerIds: string[];
  Capacity: number | null;
  CourseIds: string[];
}

export interface GradeInput {
  Name: string;
  AcademicYearId?: string;
  HomeroomInstructorId?: string;
  MemberTrainerIds?: string[];
  Capacity?: number;
  CourseIds?: string[];
}

export const gradeKeys = {
  all: ['grades'] as const,
  list: (academicYearId?: string) => ['grades', 'list', academicYearId ?? ''] as const,
};

export const useGradesQuery = (academicYearId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: gradeKeys.list(academicYearId),
    queryFn: async () => (await api.get<Grade[]>('/grades', { params: { academicYearId: academicYearId || undefined } })).data,
    enabled: !!user,
  });
};

export const useSaveGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: GradeInput }) => {
      const res = id ? await api.put<Grade>(`/grades/${id}`, input) : await api.post<Grade>('/grades', input);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gradeKeys.all });
      void queryClient.invalidateQueries({ queryKey: academicYearKeys.all }); // GradesCount per year
    },
  });
};

export const useDeleteGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/grades/${id}`); },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gradeKeys.all });
      void queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
    },
  });
};
