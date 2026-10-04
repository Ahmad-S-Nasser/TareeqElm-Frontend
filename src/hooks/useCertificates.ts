/**
 * Certificates (phase 3 of the certificates project).
 *
 *   GET  /api/certificates/me                  certificates.self (Trainer)      the caller's own certificates
 *   GET  /api/certificates/verify/{code}       anonymous                        what is printed on one certificate; 404 = no match
 *   POST /api/certificates/academic            certificates.issue (Org/Admin)   issue an academic certificate by hand
 *   PUT  /api/Courses/{id}/certificate-config  certificates.manage             exam gate of a course
 *   PUT  /api/tracks/{id}/certificate-config   certificates.manage (Org/Admin)  capstone exam gate of a track
 *
 * **The exam threshold is the chosen quiz's own `PassingScore`** — there is deliberately no second number to configure
 * here. Turning the exam on without choosing a quiz is refused by the server (`certificate.exam_quiz_invalid`) and
 * blocked by the editors before it is ever sent.
 *
 * Certificates are printed with plain print-CSS (see `CertificateView`); their trust comes from the stable public
 * `/verify/:code` URL printed on them, not from the file format.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys } from './useBilling';

export type CertificateScope = 'Course' | 'Track' | 'Academic';

/** `CertificateDto` — one of the caller's own certificates. */
export interface Certificate {
  Id: string;
  Scope: CertificateScope;
  CourseId: string | null;
  TrackId: string | null;
  GradeId: string | null;
  OrganizationId: string | null;
  /** Null for a platform-level credential; the UI shows the platform name instead. */
  OrganizationName: string | null;
  TrainerId: string;
  TrainerName: string | null;
  /** Snapshotted at issue time: a later rename never changes a certificate. */
  Title: string;
  IssuedAt: string;
  VerificationCode: string;
  /** The best passing percentage on the exam, snapshotted at issue time; null when no exam was required. */
  ExamPercentage: number | null;
  /** A manually issued academic certificate. */
  Manual: boolean;
}

/** `CertificateVerificationDto` — the public answer: only what is printed on the certificate. */
export interface CertificateVerification {
  VerificationCode: string;
  Scope: CertificateScope;
  TrainerName: string | null;
  Title: string;
  IssuerName: string | null;
  IssuedAt: string;
  ExamPercentage: number | null;
}

/** `CertificateConfigDto` — the body of both certificate-config endpoints. */
export interface CertificateConfig {
  CertificateRequiresExam: boolean;
  CertificateExamQuizId: string | null;
}

export interface AcademicCertificateIssue {
  TrainerId: string;
  Title: string;
}

/** The error code a misconfigured exam gate is refused with. */
export const CERTIFICATE_EXAM_QUIZ_INVALID = 'certificate.exam_quiz_invalid';

/** True when the configuration can be saved: no exam, or an exam with a quiz chosen. */
export const isCertificateConfigValid = (config: CertificateConfig): boolean =>
  !config.CertificateRequiresExam || !!config.CertificateExamQuizId;

/** The public verification page for a code, as printed on the certificate. */
export const certificateVerifyUrl = (code: string, origin: string = window.location.origin): string =>
  `${origin}/verify/${encodeURIComponent(code)}`;

export const certificateKeys = {
  all: ['certificates'] as const,
  mine: (userId?: string) => ['certificates', 'me', userId] as const,
  verify: (code?: string) => ['certificates', 'verify', code] as const,
};

/** `GET /api/certificates/me` — the trainee's own certificates, newest first. */
export const useMyCertificatesQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: certificateKeys.mine(user?.Id),
    queryFn: async () => (await api.get<Certificate[]>('/certificates/me')).data,
    enabled: !!user,
  });
};

/** `GET /api/certificates/verify/{code}` — anonymous; a 404 means "no certificate has this code" (not retried). */
export const useCertificateVerificationQuery = (code?: string) =>
  useQuery({
    queryKey: certificateKeys.verify(code),
    queryFn: async () => (await api.get<CertificateVerification>(`/certificates/verify/${encodeURIComponent(code!)}`)).data,
    enabled: !!code,
    retry: false,
  });

/** `PUT /api/Courses/{id}/certificate-config` — 204, or 400 `certificate.exam_quiz_invalid`. */
export const useSetCourseCertificateConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ courseId, config }: { courseId: string; config: CertificateConfig }) => {
      await api.put(`/Courses/${courseId}/certificate-config`, config);
      return courseId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: certificateKeys.all }),
  });
};

/** `PUT /api/tracks/{id}/certificate-config` — the capstone quiz must belong to one of the track's courses. */
export const useSetTrackCertificateConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, config }: { trackId: string; config: CertificateConfig }) => {
      await api.put(`/tracks/${trackId}/certificate-config`, config);
      return trackId;
    },
    // The config travels on the track DTOs, whose keys live under the billing prefix.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
};

/** `POST /api/certificates/academic` — 200 with the issued certificate, or 400 `certificate.invalid`. */
export const useIssueAcademicCertificate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AcademicCertificateIssue) => (await api.post<Certificate>('/certificates/academic', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: certificateKeys.all }),
  });
};
