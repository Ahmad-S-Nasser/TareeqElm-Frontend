import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AxiosProgressEvent } from 'axios';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface ContentItem {
  Id: string;
  Name: string;
  /** pdf | video | image | presentation | document */
  FileType: string;
  Department: string;
  CourseName: string | null;
  CourseId: string | null;
  /** Current title of CourseId; null when the item has no course or the course was deleted. */
  CourseTitle: string | null;
  FilePath: string;
  /** Authorized download endpoint; use this, never FilePath. */
  DownloadUrl: string;
  FileSizeBytes: number;
  UploadedById: string | null;
  /** Uploader's name as recorded at upload; null when it was never recorded. */
  UploadedByName: string | null;
  CreatedAt: string;
}

export interface ContentLibraryFilters {
  search?: string;
  courseId?: string;
  type?: string;
}

export const contentLibraryKeys = {
  list: (userId?: string, filters?: ContentLibraryFilters) =>
    ['content-library', userId, filters?.search ?? '', filters?.courseId ?? '', filters?.type ?? ''] as const,
};

/** GET /api/content-library?search=&courseId=&type= — server scopes the results to the caller. */
export const useContentLibraryQuery = (filters: ContentLibraryFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: contentLibraryKeys.list(user?.Id, filters),
    queryFn: async () =>
      (
        await api.get<ContentItem[]>('/content-library', {
          params: {
            search: filters.search || undefined,
            courseId: filters.courseId || undefined,
            type: filters.type || undefined,
          },
        })
      ).data,
    enabled: !!user,
  });
};

const useInvalidateContentLibrary = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['content-library', user?.Id] });
};

export interface UploadContentInput {
  file: File;
  department?: string;
  courseId?: string;
  courseName?: string;
  onProgress?: (percent: number) => void;
}

export const useUploadContentItem = () => {
  const invalidate = useInvalidateContentLibrary();
  return useMutation({
    mutationFn: async ({ file, department, courseId, courseName, onProgress }: UploadContentInput) => {
      const formData = new FormData();
      formData.append('file', file);
      if (department) formData.append('department', department);
      if (courseId) formData.append('courseId', courseId);
      if (courseName) formData.append('courseName', courseName);
      return (
        await api.post<ContentItem>('/content-library', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event: AxiosProgressEvent) => {
            if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
          },
        })
      ).data;
    },
    onSuccess: invalidate,
  });
};

export const useDeleteContentItem = () => {
  const invalidate = useInvalidateContentLibrary();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/content-library/${id}`);
    },
    onSuccess: invalidate,
  });
};

/** Downloads an item through the authorized endpoint (it requires the bearer token, so a plain <a href> cannot be used). */
export const useDownloadContentItem = () => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const download = async (item: ContentItem) => {
    setDownloadingId(item.Id);
    try {
      const response = await api.get(`/content-library/${item.Id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.Name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };
  return { download, downloadingId };
};
