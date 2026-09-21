import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApplicantSidebar } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Chapter, Lesson, LessonType } from "@/components/courses/courseChapters";
import { ChapterAccordion } from "@/components/courses/ChapterAccordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import api, { getApiError } from "@/lib/api";
import { useCourses } from "@/hooks/useCourses";
import { useProgress } from "@/hooks/useProgress";
import { Loader2 } from "lucide-react";
import {
    ArrowLeft,
    Clock,
    BookOpen,
    Users,
    Play,
    AlertCircle,
    GraduationCap,
    Lock,
    ClipboardCheck
} from "lucide-react";

interface LessonDto {
    Id: string;
    Title: string;
    LessonType: string;
    Content: string | null;
    VideoUrl: string | null;
    OrderIndex: number;
    DurationMinutes: number | null;
}

interface ChapterDto {
    Id: string;
    Title: string;
    Description: string | null;
    OrderIndex: number;
    Lessons: LessonDto[];
}

interface CourseDetailDto {
    Id: string;
    Title: string;
    Description: string | null;
    Category: string | null;
    Level: string | null;
    InstructorName: string | null;
    LessonsCount: number;
    EnrolledCount: number;
    DurationHours: number | null;
    ContentUnlocked: boolean;
    Chapters: ChapterDto[];
}

const LESSON_TYPE_MAP: Record<string, LessonType> = {
    video: "video",
    reading: "reading",
    quiz: "quiz",
    assignment: "exercise",
    interactive: "exercise",
};

const CourseDetail = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation(["courses", "common"]);
    const { formatNumber, formatPercent, formatDuration } = useFormatters();
    const formatMinutes = (minutes: number) => formatDuration(minutes * 60);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [openChapterId, setOpenChapterId] = useState<string | null>(null);
    const [enrolling, setEnrolling] = useState(false);

    const { enrollInCourse } = useCourses();
    const { courseProgress, courseProgressLoading } = useProgress(courseId);

    const courseQuery = useQuery({
        queryKey: ["course-detail", courseId],
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

    const detail = courseQuery.data;
    const loading = courseQuery.isLoading || courseProgressLoading;
    const enrolled = !!courseProgress;
    const contentUnlocked = detail?.ContentUnlocked !== false;
    const completedIds = useMemo(() => new Set(courseProgress?.CompletedLessonIds ?? []), [courseProgress]);

    const chapters = useMemo<Chapter[]>(() => {
        if (!detail) return [];
        return [...(detail.Chapters ?? [])]
            .sort((a, b) => a.OrderIndex - b.OrderIndex)
            .map((ch) => {
                const lessons: Lesson[] = [...(ch.Lessons ?? [])]
                    .sort((a, b) => a.OrderIndex - b.OrderIndex)
                    .map((l, i) => ({
                        Id: l.Id,
                        ChapterId: ch.Id,
                        Number: i + 1,
                        Title: l.Title,
                        Type: LESSON_TYPE_MAP[l.LessonType?.toLowerCase()] ?? "reading",
                        Duration: l.DurationMinutes ? formatMinutes(l.DurationMinutes) : "",
                        IsCompleted: completedIds.has(l.Id),
                        IsLocked: !contentUnlocked,
                        Content: l.Content ?? undefined,
                    }));
                const minutes = (ch.Lessons ?? []).reduce((sum, l) => sum + (l.DurationMinutes ?? 0), 0);
                return {
                    Id: ch.Id,
                    CourseId: detail.Id,
                    Number: ch.OrderIndex + 1,
                    Title: ch.Title,
                    Description: ch.Description || "",
                    Duration: minutes > 0 ? formatMinutes(minutes) : "",
                    IsCompleted: lessons.length > 0 && lessons.every((l) => l.IsCompleted),
                    IsLocked: !contentUnlocked,
                    Lessons: lessons,
                };
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detail, completedIds, contentUnlocked, t]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    if (courseQuery.error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t("detail.loadFailedTitle")}</h2>
                    <p className="text-muted-foreground mb-4">{getApiError(courseQuery.error, t("detail.loadFailed"))}</p>
                    <Button onClick={() => courseQuery.refetch()}>{t("common:actions.retry")}</Button>
                </div>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t("detail.notFound")}</h2>
                    <p className="text-muted-foreground mb-4">{t("detail.notFoundDesc")}</p>
                    <Button onClick={() => navigate("/courses")}>
                        <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                        {t("detail.backToCourses")}
                    </Button>
                </div>
            </div>
        );
    }

    const course = detail;
    const totalLessons = course.LessonsCount || chapters.reduce((sum, ch) => sum + ch.Lessons.length, 0);
    const completedLessons = chapters.reduce(
        (sum, ch) => sum + ch.Lessons.filter(l => l.IsCompleted).length,
        0
    );
    const completedChapters = chapters.filter(ch => ch.IsCompleted).length;
    const progressPercent = Math.round(courseProgress?.ProgressPercentage ?? 0);

    const handleChapterToggle = (chapterId: string) => {
        setOpenChapterId(prev => prev === chapterId ? null : chapterId);
    };

    const handleLessonClick = (lessonId: string) => {
        if (!contentUnlocked) return;
        navigate(`/courses/${course.Id}/lessons/${lessonId}`);
    };

    const getLevelColor = (level: string | null) => {
        const l = level?.toLowerCase();
        switch (l) {
            case "beginner": return "bg-success/10 text-success border-success/20";
            case "intermediate": return "bg-warning/10 text-warning border-warning/20";
            case "advanced": return "bg-destructive/10 text-destructive border-destructive/20";
            default: return "bg-muted text-muted-foreground";
        }
    };

    // Find the next incomplete lesson
    const getNextLesson = () => {
        for (const chapter of chapters) {
            if (chapter.IsLocked) continue;
            const next = chapter.Lessons.find(l => !l.IsCompleted && !l.IsLocked);
            if (next) return { chapter, lesson: next };
        }
        return null;
    };

    const nextLesson = getNextLesson();

    const handleEnroll = async () => {
        if (!courseId) return;
        setEnrolling(true);
        const { error } = await enrollInCourse(courseId, detail?.Title);
        if (!error) {
            await Promise.all([
                courseQuery.refetch(),
                queryClient.invalidateQueries({ queryKey: ["course-progress"] }),
                queryClient.invalidateQueries({ queryKey: ["enrollments-me"] }),
            ]);
        }
        setEnrolling(false);
    };

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main
                className={cn(
                    "pt-20 pb-8 px-6 transition-all duration-300",
                    sidebarCollapsed ? "ms-20" : "ms-64"
                )}
            >
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Back Button */}
                    <Button
                        variant="ghost"
                        onClick={() => navigate("/courses")}
                        className="gap-2 -ms-2"
                    >
                        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                        {t("detail.backToCourses")}
                    </Button>

                    {/* Course Header Card */}
                    <section className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-soft animate-slide-up">
                        {/* Banner */}
                        <div className={cn(
                            "h-48 relative",
                            course.Category?.toLowerCase() === "certification" && "gradient-primary",
                            course.Category?.toLowerCase() === "automation" && "gradient-accent",
                            course.Category?.toLowerCase() === "agile" && "gradient-success",
                            course.Category?.toLowerCase() === "testing-techniques" && "bg-gradient-to-br from-amber-500 to-orange-600",
                            course.Category?.toLowerCase() === "tools" && "bg-gradient-to-br from-cyan-500 to-blue-600",
                            course.Category?.toLowerCase() === "soft-skills" && "bg-gradient-to-br from-pink-500 to-rose-600",
                        )}>
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                            <div className="absolute bottom-4 start-6 end-6">
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <Badge className="bg-white/20 text-white border-0">
                                        {course.Category ? t(`category.${course.Category.toLowerCase()}`, { defaultValue: course.Category }) : ""}
                                    </Badge>
                                    <Badge variant="outline" className={cn("border-white/30 text-white", getLevelColor(course.Level))}>
                                        {course.Level ? t(`level.${course.Level.toLowerCase()}`, { defaultValue: course.Level }) : ""}
                                    </Badge>
                                </div>
                                <h1 className="text-3xl font-bold text-white">{course.Title}</h1>
                            </div>
                        </div>

                        {/* Course Info */}
                        <div className="p-6">
                            <p className="text-muted-foreground mb-6">{course.Description}</p>

                            {/* Stats Row */}
                            <div className="flex flex-wrap items-center gap-6 mb-6">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="w-5 h-5" />
                                    <span>{t("detail.trainersCount", { count: course.EnrolledCount ?? 0 })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="w-5 h-5" />
                                    <span>{t("hoursCount", { count: course.DurationHours ?? 0 })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <BookOpen className="w-5 h-5" />
                                    <span>{t("lessonsCount", { count: totalLessons })}</span>
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="p-4 rounded-xl bg-muted/30 mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">{t("detail.yourProgress")}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {t("detail.lessonsCompleted", { done: formatNumber(completedLessons), total: formatNumber(totalLessons) })}
                                    </span>
                                </div>
                                <Progress value={progressPercent} className="h-3 mb-2" />
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {t("detail.chaptersDone", { done: formatNumber(completedChapters), total: formatNumber(chapters.length) })}
                                    </span>
                                    <span className="font-semibold text-primary">{formatPercent(progressPercent)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-4">
                                {enrolled ? (
                                    nextLesson && (
                                        <Button
                                            size="lg"
                                            className="gap-2"
                                            onClick={() => {
                                                navigate(`/courses/${course.Id}/lessons/${nextLesson.lesson.Id}`);
                                            }}
                                        >
                                            <Play className="w-5 h-5" />
                                            {t("detail.continueLesson", { title: nextLesson.lesson.Title })}
                                        </Button>
                                    )
                                ) : (
                                    <Button
                                        size="lg"
                                        className="gap-2"
                                        onClick={handleEnroll}
                                        disabled={enrolling}
                                    >
                                        {enrolling ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <GraduationCap className="w-5 h-5" />
                                        )}
                                        {t("detail.enrollNow")}
                                    </Button>
                                )}
                                {enrolled && (
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => navigate(`/quizzes?courseId=${course.Id}`)}
                                    >
                                        <ClipboardCheck className="w-5 h-5" />
                                        {t("detail.quizzes")}
                                    </Button>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {enrolled ? (
                                        nextLesson
                                            ? `${t("detail.chapterN", { number: formatNumber(nextLesson.chapter.Number) })}${nextLesson.lesson.Duration ? ` • ${nextLesson.lesson.Duration}` : ""}`
                                            : chapters.length === 0 ? t("detail.noLessonsYet") : t("detail.courseCompleted")
                                    ) : (
                                        t("detail.enrollToStart")
                                    )}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Two Column Layout */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Main Content - Chapters */}
                        <div className="lg:col-span-2 space-y-4">
                            <h2 className="text-xl font-semibold">{t("detail.courseContent")}</h2>
                            <div className="space-y-3">
                                {!contentUnlocked && (
                                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Lock className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{t("detail.unlockTitle")}</p>
                                            <p className="text-sm text-muted-foreground">{t("detail.unlockDesc")}</p>
                                        </div>
                                        <Button onClick={handleEnroll} disabled={enrolling} className="gap-2">
                                            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                                            {t("detail.enrollNow")}
                                        </Button>
                                    </div>
                                )}
                                {chapters.length === 0 && (
                                    <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-muted-foreground">
                                        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>{t("detail.noLessons")}</p>
                                    </div>
                                )}
                                {chapters.map((chapter) => (
                                    <ChapterAccordion
                                        key={chapter.Id}
                                        chapter={chapter}
                                        isOpen={openChapterId === chapter.Id}
                                        onToggle={() => handleChapterToggle(chapter.Id)}
                                        onLessonClick={handleLessonClick}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-4">
                            {/* Instructor */}
                            <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-5">
                                <h3 className="font-semibold mb-4">{t("detail.instructor")}</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold">
                                        {(course.InstructorName || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium">{course.InstructorName ?? t("common:labels.unknown")}</p>
                                        <p className="text-sm text-muted-foreground">{t("detail.courseInstructor")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main >
        </div >
    );
};

export default CourseDetail;
