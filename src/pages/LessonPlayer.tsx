import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useStudySession } from '@/components/learning/studySessionContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pause, Play, CheckCircle, Volume2, StopCircle, Sparkles, Lock, AlertCircle, FileText, CalendarClock, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useProgress } from '@/hooks/useProgress';
import { useCourses } from '@/hooks/useCourses';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/lib/format';
import { JoinSessionButton } from '@/components/organization/JoinSessionButton';

interface LessonDto {
    Id: string;
    Title: string;
    LessonType: string;
    Content: string | null;
    VideoUrl: string | null;
    OrderIndex: number;
    DurationMinutes: number | null;
    /** LiveOnline | Offline | PreRecorded — only PreRecorded shows the video/reading player below. */
    DeliveryMode?: string;
}

interface LessonSessionDto {
    Id: string;
    CourseId: string;
    LessonId: string;
    StartsAt: string;
    DurationMinutes: number;
    TimeZone: string;
    DeliveryMode: 'LiveOnline' | 'Offline';
    Status: 'Scheduled' | 'Cancelled' | 'Completed';
    InstructorName: string | null;
    RoomName: string | null;
    LocationNote: string | null;
    AttendanceStatus: 'Present' | 'Absent' | 'Late' | 'Excused' | null;
}

const attendanceBadgeClass: Record<string, string> = {
    Present: 'bg-emerald-500/10 text-emerald-600',
    Absent: 'bg-destructive/10 text-destructive',
    Late: 'bg-amber-500/10 text-amber-600',
    Excused: 'bg-muted text-muted-foreground',
};

/**
 * What a LiveOnline/Offline lesson shows instead of the video/reading player: every scheduled occurrence, with a Join
 * button (LiveOnline, not yet attended) or the room (Offline), mirroring MyAttendance.tsx's own status-badge pattern —
 * there is no "joinable now" time-window check anywhere in this app, so this lists sessions the same status-based way.
 */
const LessonSessionsPanel = ({ courseId, lessonId }: { courseId: string; lessonId: string }) => {
    const { t } = useTranslation(['learning', 'common']);
    const { formatDateTime } = useFormatters();

    const { data: sessions = [], isLoading, isError, error } = useQuery({
        queryKey: ['lesson-sessions', courseId, lessonId],
        queryFn: async () => (await api.get<LessonSessionDto[]>(`/courses/${courseId}/lessons/${lessonId}/sessions`)).data,
        enabled: !!courseId && !!lessonId,
    });

    if (isLoading) {
        return (
            <Card className="aspect-video flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </Card>
        );
    }

    if (isError) {
        return (
            <Card className="aspect-video flex items-center justify-center bg-muted/30">
                <p className="text-sm text-destructive px-6 text-center">{getApiError(error, t('player.session.loadFailed'))}</p>
            </Card>
        );
    }

    if (sessions.length === 0) {
        return (
            <Card className="aspect-video flex items-center justify-center bg-muted/30">
                <div className="text-center text-muted-foreground px-6">
                    <CalendarClock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('player.session.notScheduled')}</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {sessions.map((session) => (
                <Card key={session.Id} className="border-border/50">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                                <p className="text-sm font-medium">
                                    {formatDateTime(session.StartsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: session.TimeZone })}
                                </p>
                                {session.AttendanceStatus ? (
                                    <Badge className={attendanceBadgeClass[session.AttendanceStatus]}>
                                        {t(`myAttendance.status.${session.AttendanceStatus.toLowerCase()}`)}
                                    </Badge>
                                ) : session.Status === 'Cancelled' ? (
                                    <Badge variant="outline">{t('myAttendance.cancelled')}</Badge>
                                ) : session.Status === 'Scheduled' ? (
                                    <Badge variant="outline">{t('myAttendance.upcoming')}</Badge>
                                ) : null}
                            </div>
                            {session.DeliveryMode === 'Offline' ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                    {session.RoomName ?? t('player.session.roomTbd')}
                                    {session.LocationNote ? ` · ${session.LocationNote}` : ''}
                                </p>
                            ) : (
                                session.InstructorName && <p className="text-xs text-muted-foreground">{session.InstructorName}</p>
                            )}
                        </div>
                        {session.DeliveryMode === 'LiveOnline' && session.Status === 'Scheduled' && !session.AttendanceStatus && (
                            <JoinSessionButton courseId={courseId} sessionId={session.Id} />
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

interface CourseDetailDto {
    Id: string;
    Title: string;
    ContentUnlocked: boolean;
    Chapters: { Id: string; Title: string; Lessons: LessonDto[] }[];
}

const apiOrigin = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
const resolveMediaUrl = (url: string) => (url.startsWith('/') ? `${apiOrigin}${url}` : url);

const LessonPlayer = () => {
    const { courseId, lessonId } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(['learning', 'common']);
    const { toast } = useToast();
    const {
        startSession,
        endSession,
        pauseSession,
        resumeSession,
        isTracking,
        sessionDuration,
    } = useStudySession();
    const { completeLesson, isLessonCompleted, isCompleting } = useProgress(courseId);
    const { enrollInCourse } = useCourses();
    const [enrolling, setEnrolling] = useState(false);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Selection & Explanation State
    const [selection, setSelection] = useState<{ x: number, y: number, text: string } | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [explanationLoading, setExplanationLoading] = useState(false);
    const [explanationText, setExplanationText] = useState("");
    const [explainedText, setExplainedText] = useState("");

    const courseQuery = useQuery({
        queryKey: ['course-detail', courseId],
        queryFn: async () => {
            try {
                return (await api.get<CourseDetailDto>(`/Courses/${courseId}`)).data;
            } catch (e) {
                if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
                throw e;
            }
        },
        enabled: !!courseId,
    });

    const course = courseQuery.data;
    const contentUnlocked = course?.ContentUnlocked !== false;
    const lesson = useMemo(() => {
        for (const chapter of course?.Chapters ?? []) {
            const found = chapter.Lessons.find(l => l.Id === lessonId);
            if (found) return found;
        }
        return null;
    }, [course, lessonId]);

    const lessonTitle = lesson?.Title ?? "";
    const lessonContent = contentUnlocked ? (lesson?.Content ?? "") : "";
    const videoUrl = contentUnlocked && lesson?.VideoUrl ? resolveMediaUrl(lesson.VideoUrl) : null;
    const isScheduledLesson = lesson?.DeliveryMode === 'LiveOnline' || lesson?.DeliveryMode === 'Offline';
    const completed = !!lessonId && isLessonCompleted(lessonId);

    // Track study time only when the lesson is actually available to the trainer.
    const sessionKey = courseId && lessonId && lesson && contentUnlocked ? `${courseId}:${lessonId}` : null;
    // The provider's startSession is not referentially stable; keep the latest one in a ref so the
    // effect below only re-runs when the lesson actually changes.
    const startSessionRef = useRef(startSession);
    startSessionRef.current = startSession;
    useEffect(() => {
        if (!sessionKey || !courseId || !lessonId) return;
        startSessionRef.current(courseId, lessonId);
        return () => {
            window.speechSynthesis.cancel();
        };
    }, [sessionKey, courseId, lessonId]);

    useEffect(() => {
        const handleSelection = () => {
            const selectionObj = window.getSelection();
            if (!selectionObj || selectionObj.isCollapsed) {
                setSelection(null);
                return;
            }

            const text = selectionObj.toString().trim();
            if (text.length < 5) {
                setSelection(null);
                return;
            }

            // Ensure selection is within our content area
            if (textRef.current && textRef.current.contains(selectionObj.anchorNode)) {
                const range = selectionObj.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Show popup near selection
                setSelection({
                    x: rect.left + (rect.width / 2),
                    y: rect.top - 10,
                    text: text
                });
            } else {
                setSelection(null);
            }
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Completion is an explicit action: only this button marks the lesson done.
    const handleComplete = async () => {
        if (!courseId || !lessonId) return;
        window.speechSynthesis.cancel();
        if (!completed) {
            const { error } = await completeLesson(courseId, lessonId, true);
            if (error) return;
            toast({ title: t('player.lessonCompleted'), description: t('player.progressSaved') });
        }
        await endSession();
        navigate(`/courses/${courseId}`);
    };

    const handleEnroll = async () => {
        if (!courseId) return;
        setEnrolling(true);
        const { error } = await enrollInCourse(courseId, course?.Title);
        if (!error) await courseQuery.refetch();
        setEnrolling(false);
    };

    const toggleSpeech = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(lessonContent);
            utterance.lang = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
            utterance.onend = () => setIsSpeaking(false);
            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    const handleExplain = async () => {
        if (!selection) return;
        const text = selection.text;

        setExplainedText(text);
        setExplanationText("");
        setShowExplanation(true);
        setExplanationLoading(true);

        try {
            const response = await api.post<{ Content: string }>('/AI/coach', {
                Messages: [{ Role: 'user', Content: t('player.explainPrompt', { title: lessonTitle, text }) }],
                Mode: 'chat',
            });
            setExplanationText(response.data.Content);
        } catch (error) {
            setShowExplanation(false);
            toast({ title: t('player.explainFailed'), description: getApiError(error), variant: 'destructive' });
        } finally {
            setExplanationLoading(false);
        }
    };

    if (courseQuery.isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (courseQuery.error || !course || !lesson) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="text-center">
                    <AlertCircle className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('player.notAvailable')}</h2>
                    <p className="text-muted-foreground mb-4">
                        {courseQuery.error ? getApiError(courseQuery.error, t('player.loadFailed')) : t('player.notFoundDesc')}
                    </p>
                    <Button onClick={() => navigate(courseId ? `/courses/${courseId}` : '/courses')}>
                        <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> {t('player.backToCourse')}
                    </Button>
                </div>
            </div>
        );
    }

    if (!contentUnlocked) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">{t('player.enrollToView')}</h2>
                    <p className="text-muted-foreground mb-6">
                        {t('player.enrollToViewDesc', { lesson: lessonTitle, course: course.Title })}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Button variant="outline" onClick={() => navigate(`/courses/${courseId}`)}>
                            <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> {t('player.backToCourse')}
                        </Button>
                        <Button onClick={handleEnroll} disabled={enrolling}>
                            {enrolling && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t('player.enrollNow')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card fixed top-0 start-0 end-0 z-50">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${courseId}`)} className="h-8 px-2">
                        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                    </Button>
                    <h1 className="font-semibold text-base sm:text-lg line-clamp-1">{lessonTitle || t('player.title')}</h1>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="font-mono text-lg sm:text-xl font-medium bg-muted px-3 py-1.5 rounded-md flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span dir="ltr">{formatTime(sessionDuration)}</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative mt-32 sm:mt-20">
                {/* Video Player Section */}
                <div className="lg:col-span-2 space-y-4">
                    {isScheduledLesson && courseId && lessonId ? (
                        <LessonSessionsPanel courseId={courseId} lessonId={lessonId} />
                    ) : videoUrl ? (
                        <Card className="overflow-hidden bg-black aspect-video relative group">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                controls
                                src={videoUrl}
                            >
                                {t('player.noVideoSupport')}
                            </video>
                        </Card>
                    ) : (
                        <Card className="aspect-video flex items-center justify-center bg-muted/30">
                            <div className="text-center text-muted-foreground px-6">
                                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">{t('player.noVideo')}</p>
                            </div>
                        </Card>
                    )}

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2">
                            {isTracking ? (
                                <Button variant="outline" onClick={pauseSession}>
                                    <Pause className="w-4 h-4 me-2" /> {t('player.pause')}
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={resumeSession}>
                                    <Play className="w-4 h-4 me-2" /> {t('player.resume')}
                                </Button>
                            )}
                        </div>

                        <Button variant={completed ? "outline" : "default"} onClick={handleComplete} disabled={isCompleting}>
                            {isCompleting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <CheckCircle className="w-4 h-4 me-2" />}
                            {completed ? t('player.completedBack') : t('player.complete')}
                        </Button>
                    </div>
                </div>

                {/* Text Content Section */}
                <div className="lg:col-span-1 h-auto lg:h-[calc(100vh-10rem)] flex flex-col">
                    <Card className="flex-1 flex flex-col">
                        <CardContent className="p-0 flex flex-col h-full">
                            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                                <h3 className="font-semibold">{t('player.material')}</h3>
                                <Button
                                    variant={isSpeaking ? "destructive" : "secondary"}
                                    size="sm"
                                    onClick={toggleSpeech}
                                    disabled={!lessonContent.trim()}
                                >
                                    {isSpeaking ? (
                                        <>
                                            <StopCircle className="w-4 h-4 me-2" /> {t('player.stopReading')}
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 className="w-4 h-4 me-2" /> {t('player.readAloud')}
                                        </>
                                    )}
                                </Button>
                            </div>
                            <ScrollArea className="flex-1 p-4 relative" >
                                <article ref={textRef} className="prose prose-sm dark:prose-invert max-w-none">
                                    {!lessonContent.trim() && (
                                        <p className="text-sm text-muted-foreground">{t('player.noMaterial')}</p>
                                    )}
                                    {lessonContent.split('\n').map((paragraph, idx) => (
                                        <p key={idx} className="mb-4 leading-relaxed text-muted-foreground">
                                            {paragraph}
                                        </p>
                                    ))}
                                </article>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Explain Popup Logic */}
                {selection && (
                    <div
                        className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
                        style={{ top: selection.y, left: selection.x }}
                    >
                        <Button
                            size="sm"
                            className="shadow-xl bg-primary text-primary-foreground animate-in fade-in zoom-in duration-200"
                            onClick={handleExplain}
                        >
                            <Sparkles className="w-3 h-3 me-2" />
                            {t('player.explainClip')}
                        </Button>
                    </div>
                )}
            </main>

            {/* Explanation Dialog */}
            <Dialog open={showExplanation} onOpenChange={setShowExplanation}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            {t('player.explanation')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('player.explanationDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="bg-muted/50 p-3 rounded-md mb-4 text-xs text-muted-foreground border-s-2 border-primary italic">
                            "{explainedText}"
                        </div>

                        {explanationLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-foreground/80">{t('player.analyzing')}</p>
                            </div>
                        ) : (
                            <div className="text-sm leading-relaxed">
                                {explanationText.split('\n\n').map((text, i) => (
                                    <p key={i} className="mb-2">{text}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowExplanation(false)}>{t('common:actions.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LessonPlayer;
