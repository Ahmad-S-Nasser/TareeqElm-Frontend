import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosProgressEvent } from 'axios';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface Attachment {
  Url: string;
  Name: string;
  SizeBytes: number;
}

export interface AssignmentSubmission {
  Id: string;
  AssignmentId: string;
  TrainerId: string;
  /** Null when the trainer's account no longer exists. */
  TrainerName: string | null;
  Text: string | null;
  Files: Attachment[];
  SubmittedAt: string;
  Score: number | null;
  Feedback: string | null;
  GradedAt: string | null;
  /** submitted | late | graded */
  Status: string;
}

export interface Assignment {
  Id: string;
  CourseId: string;
  /** Current title of the course; null when it was deleted. */
  CourseTitle: string | null;
  Title: string;
  Description: string;
  DueAt: string;
  MaxScore: number;
  AllowLate: boolean;
  Attachments: Attachment[];
  CreatedBy: string | null;
  CreatedByName: string | null;
  CreatedAt: string;
  /** Trainer callers only: their own submission for this assignment, if any. */
  MySubmission: AssignmentSubmission | null;
  /** Instructor/Admin/Organization callers only: how many trainers have submitted so far. */
  SubmissionCount: number | null;
  /** Instructor/Admin/Organization callers only: how many trainers are enrolled in the course. */
  EnrolledCount: number | null;
}

export interface AssignmentSave {
  CourseId: string;
  Title: string;
  Description: string;
  /** ISO datetime string. */
  DueAt: string;
  MaxScore: number;
  AllowLate: boolean;
  Attachments?: Attachment[];
}

export interface SubmissionSave {
  Text?: string;
  Files?: Attachment[];
}

export interface GradeSubmissionInput {
  Score: number;
  Feedback?: string;
}

export const assignmentKeys = {
  list: (userId?: string, courseId?: string) => ['assignments', userId, courseId ?? 'all'] as const,
  detail: (id?: string) => ['assignment', id] as const,
  submissions: (id?: string) => ['assignment-submissions', id] as const,
};

/** GET /api/assignments?courseId= — scoped server-side (instructor: own courses; trainer: enrolled courses). */
export const useAssignmentsQuery = (courseId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: assignmentKeys.list(user?.Id, courseId),
    queryFn: async () => (await api.get<Assignment[]>('/Assignments', { params: courseId ? { courseId } : undefined })).data,
    enabled: !!user,
  });
};

export const useAssignmentQuery = (id?: string) =>
  useQuery({
    queryKey: assignmentKeys.detail(id),
    queryFn: async () => (await api.get<Assignment>(`/Assignments/${id}`)).data,
    enabled: !!id,
  });

const useInvalidateAssignments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['assignments', user?.Id] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.submissions(id) });
    }
  };
};

export const useCreateAssignment = () => {
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: async (body: AssignmentSave) => (await api.post<Assignment>('/Assignments', body)).data,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateAssignment = () => {
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: AssignmentSave }) =>
      (await api.put<Assignment>(`/Assignments/${id}`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
};

export const useDeleteAssignment = () => {
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Assignments/${id}`);
    },
    onSuccess: () => invalidate(),
  });
};

export interface UploadFileInput {
  file: File;
  onProgress?: (percent: number) => void;
}

const uploadFile = async (url: string, { file, onProgress }: UploadFileInput) => {
  const formData = new FormData();
  formData.append('file', file);
  return (
    await api.post<Attachment>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    })
  ).data;
};

/** POST /api/assignments/upload (assignments.manage) — returns an Attachment to include in AssignmentSave.Attachments. */
export const useUploadAssignmentAttachment = () =>
  useMutation({
    mutationFn: (input: UploadFileInput) => uploadFile('/Assignments/upload', input),
  });

/** POST /api/assignments/{id}/submissions/upload (assignments.submit) — returns an Attachment to include in SubmissionSave.Files. */
export const useUploadSubmissionFile = () =>
  useMutation({
    mutationFn: ({ assignmentId, ...input }: UploadFileInput & { assignmentId: string }) =>
      uploadFile(`/Assignments/${assignmentId}/submissions/upload`, input),
  });

/** GET /api/assignments/{id}/submissions (assignments.manage) — every trainer's submission, for grading. */
export const useSubmissionsQuery = (assignmentId?: string) =>
  useQuery({
    queryKey: assignmentKeys.submissions(assignmentId),
    queryFn: async () => (await api.get<AssignmentSubmission[]>(`/Assignments/${assignmentId}/submissions`)).data,
    enabled: !!assignmentId,
  });

/** POST /api/assignments/{id}/submissions (assignments.submit) — create or replace the caller's own submission. */
export const useSubmitAssignment = () => {
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: async ({ assignmentId, body }: { assignmentId: string; body: SubmissionSave }) =>
      (await api.post<AssignmentSubmission>(`/Assignments/${assignmentId}/submissions`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.assignmentId),
  });
};

export const useGradeSubmission = () => {
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: async ({ assignmentId, submissionId, body }: { assignmentId: string; submissionId: string; body: GradeSubmissionInput }) =>
      (await api.post<AssignmentSubmission>(`/Assignments/${assignmentId}/submissions/${submissionId}/grade`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.assignmentId),
  });
};

/** The last path segment of a stored Url identifies the file to the download endpoints (matches the backend). */
export const attachmentFileName = (url: string) => url.slice(url.lastIndexOf('/') + 1);

const downloadBlob = async (url: string, filename: string) => {
  const response = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

/** Downloads an assignment attachment through the authorized endpoint (materials.view). */
export const useDownloadAssignmentAttachment = () => {
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const download = async (assignmentId: string, attachment: Attachment) => {
    setDownloadingUrl(attachment.Url);
    try {
      await downloadBlob(
        `/Assignments/${assignmentId}/attachments/${encodeURIComponent(attachmentFileName(attachment.Url))}/download`,
        attachment.Name
      );
    } finally {
      setDownloadingUrl(null);
    }
  };
  return { download, downloadingUrl };
};

/** Downloads a submission file through the authorized endpoint (materials.view). */
export const useDownloadSubmissionFile = () => {
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const download = async (assignmentId: string, submissionId: string, file: Attachment) => {
    setDownloadingUrl(file.Url);
    try {
      await downloadBlob(
        `/Assignments/${assignmentId}/submissions/${submissionId}/files/${encodeURIComponent(attachmentFileName(file.Url))}/download`,
        file.Name
      );
    } finally {
      setDownloadingUrl(null);
    }
  };
  return { download, downloadingUrl };
};
