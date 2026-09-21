import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import api, { getApiError } from '@/lib/api';
import i18n from '@/i18n';

const tr = (key: string, options?: Record<string, unknown>): string => i18n.t(`instructor:${key}`, options) as string;

export type LessonType = 'Reading' | 'Video' | 'Quiz' | 'Assignment' | 'Interactive';
// Older UI code (ChapterList) still creates lowercase values; they are normalised to LessonType when saving.
export type LegacyLessonType = 'video' | 'text' | 'quiz';

export interface Chapter {
    Id: string;
    Title: string;
    Description?: string | null;
    OrderIndex?: number;
    Lessons: Lesson[];
}

export interface Lesson {
    Id: string;
    Title: string;
    LessonType: LessonType | LegacyLessonType;
    Content?: string | null;
    VideoUrl?: string | null;
    DurationMinutes?: number | null;
    OrderIndex?: number;
}

interface UploadResponse {
    Url: string;
    FileType: string;
    SizeBytes: number;
    Name: string;
}

interface AnalyzedLesson {
    Title: string;
    LessonType?: string;
    Content?: string | null;
}

interface AnalyzedChapter {
    Title: string;
    Lessons?: AnalyzedLesson[];
}

const CANONICAL_TYPES: LessonType[] = ['Reading', 'Video', 'Quiz', 'Assignment', 'Interactive'];

export const normalizeLessonType = (type: string | undefined | null): LessonType => {
    const found = CANONICAL_TYPES.find((t) => t.toLowerCase() === (type ?? '').toLowerCase());
    if (found) return found;
    return 'Reading'; // 'text' and anything unknown
};

/** Translated label for a lesson type (accepts API values and legacy lowercase ones). */
export const lessonTypeLabel = (t: (key: string) => string, type: string | undefined | null): string =>
    t(`instructor:lessonType.${normalizeLessonType(type).toLowerCase()}`);

/** Origin of the API (base URL without the trailing /api), used to display uploaded files. */
export const getApiOrigin = (): string => (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');

export const useCourseEditor = (_courseId?: string) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    // Ids that exist on the server (from the last fetch/save). Only these are sent back so they update in place.
    const knownIds = useRef<Set<string>>(new Set());

    const rememberIds = (chapters: Chapter[]) => {
        const ids = new Set<string>();
        chapters.forEach((c) => {
            ids.add(c.Id);
            c.Lessons?.forEach((l) => ids.add(l.Id));
        });
        knownIds.current = ids;
    };

    const analyzeSyllabus = async (file: File): Promise<Chapter[] | null> => {
        setAnalysisError(null);
        if (!/\.(txt|md)$/i.test(file.name)) {
            const message = tr('editor.onlyTxtMd');
            setAnalysisError(message);
            toast({ title: tr('editor.unsupportedFile'), description: message, variant: 'destructive' });
            return null;
        }
        setAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post<AnalyzedChapter[]>('/AI/analyze-syllabus', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const chapters: Chapter[] = (response.data ?? []).map((ch) => ({
                Id: crypto.randomUUID(),
                Title: ch.Title,
                Lessons: (ch.Lessons ?? []).map((l) => ({
                    Id: crypto.randomUUID(),
                    Title: l.Title,
                    LessonType: normalizeLessonType(l.LessonType),
                    Content: l.Content ?? '',
                })),
            }));

            if (chapters.length === 0) {
                const message = tr('editor.noChapters');
                setAnalysisError(message);
                toast({ title: tr('editor.nothingFound'), description: message, variant: 'destructive' });
                return null;
            }

            toast({
                title: tr('editor.analysisComplete'),
                description: tr('editor.analysisCompleteDesc'),
            });
            return chapters;
        } catch (error) {
            const message = getApiError(error, tr('editor.analysisFailedMsg'));
            console.error('Analysis failed:', error);
            setAnalysisError(message);
            toast({ title: tr('editor.analysisFailed'), description: message, variant: 'destructive' });
            return null;
        } finally {
            setAnalyzing(false);
        }
    };

    const uploadMedia = async (file: File, _path?: string): Promise<string | null> => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post<UploadResponse>('/Courses/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const url = response.data.Url;
            return /^https?:\/\//i.test(url) ? url : `${getApiOrigin()}${url}`;
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: tr('editor.uploadFailed'),
                description: getApiError(error, tr('editor.uploadFailedDesc')),
                variant: 'destructive',
            });
            return null;
        } finally {
            setUploading(false);
        }
    };

    const loadCurriculum = useCallback(async (courseId: string): Promise<Chapter[]> => {
        const response = await api.get<Chapter[]>(`/Courses/${courseId}/curriculum`);
        const chapters = response.data ?? [];
        rememberIds(chapters);
        return chapters;
    }, []);

    /** Saves the curriculum and returns the saved chapters (with server ids), or null when it failed. */
    const saveCurriculum = async (courseId: string, chapters: Chapter[]): Promise<Chapter[] | null> => {
        setLoading(true);
        try {
            const curriculumData = chapters.map((chapter) => ({
                ...(knownIds.current.has(chapter.Id) ? { Id: chapter.Id } : {}),
                Title: chapter.Title,
                Description: chapter.Description ?? undefined,
                Lessons: chapter.Lessons.map((lesson) => ({
                    ...(knownIds.current.has(lesson.Id) ? { Id: lesson.Id } : {}),
                    Title: lesson.Title,
                    LessonType: normalizeLessonType(lesson.LessonType),
                    Content: lesson.Content || undefined,
                    VideoUrl: lesson.VideoUrl || undefined,
                    DurationMinutes: lesson.DurationMinutes ?? undefined,
                })),
            }));

            await api.post(`/Courses/${courseId}/curriculum`, curriculumData);
            const saved = await loadCurriculum(courseId);

            toast({
                title: tr('editor.curriculumSaved'),
                description: tr('editor.curriculumSavedDesc'),
            });
            return saved;
        } catch (error) {
            console.error('Save curriculum error:', error);
            toast({
                title: tr('editor.saveFailed'),
                description: getApiError(error, tr('editor.saveFailedDesc')),
                variant: 'destructive',
            });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const fetchCurriculum = useCallback(async (courseId: string): Promise<Chapter[]> => {
        if (!courseId) return [];
        setLoading(true);
        try {
            return await loadCurriculum(courseId);
        } catch (error) {
            console.error('Fetch curriculum error:', error);
            toast({
                title: tr('editor.fetchFailed'),
                description: getApiError(error, tr('editor.fetchFailedDesc')),
                variant: 'destructive',
            });
            return [];
        } finally {
            setLoading(false);
        }
    }, [loadCurriculum, toast]);

    return {
        loading,
        analyzing,
        uploading,
        analysisError,
        analyzeSyllabus,
        uploadMedia,
        saveCurriculum,
        fetchCurriculum,
    };
};
