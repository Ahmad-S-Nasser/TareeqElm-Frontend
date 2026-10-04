import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** One row of GET /api/Organization/at-risk-trainers: a trainer+course pair inactive for
 * NotificationScanner.AtRiskInactiveDays+ days, not completed. */
export interface AtRiskTrainer {
  TrainerId: string;
  TrainerName: string;
  DepartmentId: string | null;
  DepartmentName: string | null;
  CourseId: string;
  CourseTitle: string;
  EnrolledAt: string;
  /** Last lesson completion or study session for this trainer+course; null when there was never any activity. */
  LastActivityAt: string | null;
  DaysInactive: number;
  ProgressPercentage: number;
}

export const atRiskTrainersKey = (userId?: string) => ['at-risk-trainers', userId] as const;

/** GET /api/Organization/at-risk-trainers (organization.view). */
export const useAtRiskTrainersQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: atRiskTrainersKey(user?.Id),
    queryFn: async () => (await api.get<AtRiskTrainer[]>('/Organization/at-risk-trainers')).data,
    enabled: !!user,
  });
};
