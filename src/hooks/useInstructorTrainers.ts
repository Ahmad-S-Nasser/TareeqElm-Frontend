import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { fetchInstructorTrainerRows, InstructorTrainerRow } from './useEnrolledTrainers';

export interface AggregatedTrainer {
    id: string; // trainer id
    full_name: string;
    avatar_url: string | null;
    email?: string;
    enrolledCoursesCount: number;
    totalProgress: number; // average progress across the trainer's courses in this instructor's catalog
    averageScore: number;
    lastActive: string | null;
    courses: {
        id: string;
        title: string;
        progress: number;
    }[];
}

const aggregate = (rows: InstructorTrainerRow[]): AggregatedTrainer[] => {
    const map = new Map<string, AggregatedTrainer & { scores: number[] }>();

    rows.forEach((row) => {
        let entry = map.get(row.TrainerId);
        if (!entry) {
            entry = {
                id: row.TrainerId,
                full_name: row.FullName,
                avatar_url: row.AvatarUrl,
                email: row.Email,
                enrolledCoursesCount: 0,
                totalProgress: 0,
                averageScore: 0,
                lastActive: null,
                courses: [],
                scores: [],
            };
            map.set(row.TrainerId, entry);
        }
        entry.courses.push({ id: row.CourseId, title: row.CourseTitle, progress: Math.round(row.ProgressPercentage) });
        if (row.QuizAverage != null) entry.scores.push(row.QuizAverage);
        if (row.LastActive && (!entry.lastActive || row.LastActive > entry.lastActive)) {
            entry.lastActive = row.LastActive;
        }
    });

    return Array.from(map.values()).map(({ scores, ...t }) => ({
        ...t,
        enrolledCoursesCount: t.courses.length,
        totalProgress: t.courses.length
            ? Math.round(t.courses.reduce((sum, c) => sum + c.progress, 0) / t.courses.length)
            : 0,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    }));
};

export const useInstructorTrainers = () => {
    const { user, role } = useAuth();

    const query = useQuery({
        queryKey: ['instructor-trainers', 'all'],
        queryFn: () => fetchInstructorTrainerRows(),
        enabled: !!user && (role === 'instructor' || role === 'admin'),
    });

    const trainers = useMemo(() => aggregate(query.data ?? []), [query.data]);

    return { trainers, loading: query.isLoading, error: query.error };
};
