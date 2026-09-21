import React, { useState, useEffect, useRef } from 'react';
import api, { getApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { StudySessionContext } from './studySessionContext';

interface StudySessionDto {
    Id: string;
    CourseId: string | null;
    LessonId: string | null;
    StartedAt: string;
    EndedAt: string | null;
    DurationSeconds: number;
}

export const StudySessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0); // in seconds

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSyncRef = useRef<number>(Date.now());
    const durationRef = useRef(0);
    const sessionIdRef = useRef<string | null>(null);
    const activeLessonRef = useRef<string | null>(null);

    // Send a heartbeat (and optionally close the session). Time tracking never touches lesson completion.
    const syncProgress = async (end = false) => {
        const id = sessionIdRef.current;
        if (!id) return;
        try {
            await api.put(`/study-sessions/${id}`, { DurationSeconds: durationRef.current, End: end });
        } catch (err) {
            console.error("Study session sync error:", getApiError(err, 'Failed to sync study session'));
        }
    };

    // Timer effect
    useEffect(() => {
        if (isTracking) {
            timerRef.current = setInterval(() => {
                durationRef.current += 1;
                setSessionDuration(durationRef.current);

                // Heartbeat every minute
                const now = Date.now();
                if (now - lastSyncRef.current > 60000) {
                    lastSyncRef.current = now;
                    void syncProgress();
                }
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTracking, sessionId]);

    const endSession = async () => {
        if (!sessionIdRef.current) return;

        setIsTracking(false);
        await syncProgress(true);

        sessionIdRef.current = null;
        activeLessonRef.current = null;
        durationRef.current = 0;
        setSessionId(null);
        setActiveLessonId(null);
        setSessionDuration(0);
    };

    const startSession = async (courseId: string, lessonId: string) => {
        if (!user) return;

        // Already tracking this lesson
        if (sessionIdRef.current && activeLessonRef.current === lessonId) return;

        // If different lesson, stop previous
        if (sessionIdRef.current) {
            await endSession();
        }

        try {
            const { data } = await api.post<StudySessionDto>('/study-sessions', { CourseId: courseId, LessonId: lessonId });

            sessionIdRef.current = data.Id;
            activeLessonRef.current = lessonId;
            durationRef.current = 0;
            setSessionId(data.Id);
            setActiveLessonId(lessonId);
            setIsTracking(true);
            setSessionDuration(0);
            lastSyncRef.current = Date.now();
        } catch (err) {
            console.error("Failed to start session:", getApiError(err, 'Failed to start study session'));
        }
    };

    const pauseSession = () => setIsTracking(false);
    const resumeSession = () => setIsTracking(true);

    return (
        <StudySessionContext.Provider value={{
            activeLessonId,
            isTracking,
            sessionDuration,
            startSession,
            endSession,
            pauseSession,
            resumeSession
        }}>
            {children}
        </StudySessionContext.Provider>
    );
};
