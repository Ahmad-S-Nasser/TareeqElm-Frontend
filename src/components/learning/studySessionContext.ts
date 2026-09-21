import { createContext, useContext } from 'react';

export interface StudySessionContextType {
    activeLessonId: string | null;
    isTracking: boolean;
    sessionDuration: number;
    startSession: (courseId: string, lessonId: string) => Promise<void>;
    endSession: () => Promise<void>;
    pauseSession: () => void;
    resumeSession: () => void;
}

export const StudySessionContext = createContext<StudySessionContextType | undefined>(undefined);

export const useStudySession = () => {
    const context = useContext(StudySessionContext);
    if (context === undefined) {
        throw new Error('useStudySession must be used within a StudySessionProvider');
    }
    return context;
};
