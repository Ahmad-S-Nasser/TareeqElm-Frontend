import { useMemo } from 'react';
import { format, startOfDay, subDays } from 'date-fns';
import { getApiError } from '@/lib/api';
import {
    useEnrollmentsQuery,
    useStudySessionsQuery,
    useTrainerStatsQuery,
} from './useTrainerApi';

export interface TrainerCourseProgress {
    id: string;
    title: string;
    progress: number;
    enrolledAt: string;
    totalLessons: number;
    completedLessons: number;
}

export interface TrainerStats {
    totalStudyTime: number; // in minutes
    lessonsCompleted: number;
    coursesEnrolled: number;
    coursesCompleted: number;
    certificatesEarned: number;
    averageQuizScore: number;
    currentStreak: number;
    weeklyActivity: { day: string; minutes: number }[];
    courses: TrainerCourseProgress[];
}

export const useTrainerStats = () => {
    const statsQuery = useTrainerStatsQuery();
    const enrollmentsQuery = useEnrollmentsQuery();
    const sessionsQuery = useStudySessionsQuery();

    const stats = useMemo<TrainerStats | null>(() => {
        const data = statsQuery.data;
        const enrollments = enrollmentsQuery.data;
        if (!data || !enrollments) return null;

        const courses: TrainerCourseProgress[] = enrollments.map((e) => ({
            id: e.CourseId,
            title: e.Course?.Title ?? 'Untitled course',
            progress: Math.round(e.ProgressPercentage || 0),
            enrolledAt: e.EnrolledAt,
            totalLessons: e.Course?.LessonsCount ?? 0,
            completedLessons: Math.round(((e.ProgressPercentage || 0) / 100) * (e.Course?.LessonsCount ?? 0)),
        }));

        // Last 7 days ending today, one bucket per calendar day
        const today = startOfDay(new Date());
        const buckets = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(today, 6 - i);
            return { key: format(d, 'yyyy-MM-dd'), day: format(d, 'EEE'), minutes: 0 };
        });
        (sessionsQuery.data ?? []).forEach((s) => {
            const bucket = buckets.find((b) => b.key === format(new Date(s.StartedAt), 'yyyy-MM-dd'));
            if (bucket) bucket.minutes += Math.round((s.DurationSeconds || 0) / 60);
        });

        const coursesCompleted = enrollments.filter((e) => e.CompletedAt).length;

        return {
            totalStudyTime: Math.round(data.TotalStudyHours * 60),
            lessonsCompleted: data.LessonsCompleted,
            coursesEnrolled: data.CoursesEnrolled,
            coursesCompleted,
            certificatesEarned: coursesCompleted,
            averageQuizScore: Math.round(data.QuizAverage),
            currentStreak: data.Streak,
            weeklyActivity: buckets.map(({ day, minutes }) => ({ day, minutes })),
            courses,
        };
    }, [statsQuery.data, enrollmentsQuery.data, sessionsQuery.data]);

    const loading = statsQuery.isLoading || enrollmentsQuery.isLoading || sessionsQuery.isLoading;
    const queryError = statsQuery.error || enrollmentsQuery.error || sessionsQuery.error;
    const error = queryError ? getApiError(queryError, 'Failed to load your progress.') : null;

    return { stats, loading, error };
};
