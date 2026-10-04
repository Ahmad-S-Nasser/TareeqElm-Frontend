/**
 * Academic years of a School-kind organization.
 *
 *   GET    /api/academic-years         -> AcademicYearDto[] (newest start first; any signed-in user, scoped to their tenant)
 *   POST   /api/academic-years         { Name, StartDate, EndDate, Status? }  -> 200 AcademicYearDto
 *   PUT    /api/academic-years/{id}    same body                              -> 200 AcademicYearDto
 *   DELETE /api/academic-years/{id}                                           -> 204 (409 academic_year.in_use)
 *
 * Writes need `academic-structure.manage` and answer 403 `academic_structure.not_enabled` for a non-School organization.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export const ACADEMIC_YEAR_STATUSES = ['active', 'upcoming', 'archived'] as const;
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number];

/** `AcademicYearDto` (mirror of Nafea.Application/DTOs/AcademicYearDtos.cs). */
export interface AcademicYear {
  Id: string;
  Name: string;
  StartDate: string;
  EndDate: string;
  Status: AcademicYearStatus;
  TermsCount: number;
  GradesCount: number;
}

export interface AcademicYearInput {
  Name: string;
  StartDate: string;
  EndDate: string;
  Status?: AcademicYearStatus;
}

export const academicYearKeys = { all: ['academic-years'] as const };

export const useAcademicYearsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: academicYearKeys.all,
    queryFn: async () => (await api.get<AcademicYear[]>('/academic-years')).data,
    enabled: !!user,
  });
};

export const useSaveAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: AcademicYearInput }) => {
      const res = id ? await api.put<AcademicYear>(`/academic-years/${id}`, input) : await api.post<AcademicYear>('/academic-years', input);
      return res.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: academicYearKeys.all }),
  });
};

export const useDeleteAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/academic-years/${id}`); },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: academicYearKeys.all }),
  });
};
