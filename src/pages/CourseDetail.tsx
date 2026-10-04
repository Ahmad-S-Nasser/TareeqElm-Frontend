import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
import { PriceTag } from "@/components/billing";
import { CourseCardEnhanced, isPaidCourse, toCourseCategory, type Course as CourseCard, type CourseLevel } from "@/components/courses";
import type { CourseSummary } from "@/hooks/useTrainerApi";
import { checkoutHref } from "@/lib/checkoutLink";
import type { PricingDto, TrackRefDto } from "@/hooks/useBilling";
import { useCourses } from "@/hooks/useCourses";
import { useProgress } from "@/hooks/useProgress";
import { useContentLibraryQuery, useDownloadContentItem } from "@/hooks/useContentLibrary";
import Can from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
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
    ClipboardCheck,
    FileText,
    Download,
    Folder,
    ShoppingCart,
    Route as RouteIcon,
    CheckCircle2,
    ListChecks,
    Link2
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
    /** Per-chapter price, when this chapter is sold separately. Null = not sold on its own. */
    Pricing?: PricingDto | null;
    /** A free sample chapter: readable on a paid course without buying anything. */
    IsPreview?: boolean;
    /** The server withheld this chapter's lesson content from the caller. */
    IsLocked?: boolean;
    /** The caller can read this chapter (owns/is enrolled in the course, bought the chapter, or it is a preview). */
    Owned?: boolean;
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
    /** `Free | Subscription | AlaCarte`; only `AlaCarte` with a non-free `Pricing` gates anything. */
    AccessModel?: string | null;
    Pricing?: PricingDto | null;
    /** The caller holds an active entitlement for this course (bought it, or bought a track containing it). */
    Owned?: boolean;
    /** At least one chapter is sold separately, so locked chapters may carry their own price. */
    HasChapterPricing?: boolean;
    /** Chapters whose content the caller can actually read (all of them when `ContentUnlocked`). */
    UnlockedChapterIds?: string[];
    /** Published tracks that include this course, so we can offer the bundle instead. */
    InTracks?: TrackRefDto[];
    /** Free-text catalog tags. */
    Tags?: string[];
    /** Ordered "what you'll learn" bullets. */
    Outcomes?: string[];
    /** Courses that must be completed before self-enrolling (the server enforces it). */
    PrerequisiteCourseIds?: string[];
    /** Optional "related courses" recommendations; purely informational. */
    RelatedCourseIds?: string[];
}

/** A catalog row as the shared course card expects it (no progress: this is a recommendation, not "my courses"). */
const toCourseCard = (c: CourseSummary): CourseCard => {
    const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
    return {
        id: c.Id,
        title: c.Title,
        description: c.Description || "",
        progress: 0,
        duration: "",
        durationHours: c.DurationHours ?? 0,
        lessons: c.LessonsCount,
        category: toCourseCategory(c.Category),
        level: (c.Level?.toLowerCase() ?? "beginner") as CourseLevel,
        instructor: c.InstructorName ?? "",
        rating: 0,
        trainersEnrolled: c.EnrolledCount,
        tags: c.Tags ?? [],
        image: c.ImageUrl ? (c.ImageUrl.startsWith("/") ? `${apiOrigin}${c.ImageUrl}` : c.ImageUrl) : undefined,
        isFeatured: c.IsFeatured,
        accessModel: c.AccessModel ?? null,
        pricing: c.Pricing ?? null,
        owned: c.Owned ?? false,
        hasChapterPricing: c.HasChapterPricing ?? false,
    };
};

const LESSON_TYPE_MAP: Record<string, LessonType> = {
    video: "video",
    reading: "reading",
    quiz: "quiz",
    assignment: "exercise",
    interactive: "exercise",
};

/** Enrolled-only list of this course's shared files, downloaded through the authorized endpoint. */
const CourseMaterials = ({ courseId }: { courseId: string }) => {
    const { t } = useTranslation("courses");
    const { formatNumber } = useFormatters();
    const { data: items = [], isLoading, isError, error } = useContentLibraryQuery({ courseId });
    const { download, downloadingId } = useDownloadContentItem();

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return t("materials.units.KB", { value: formatNumber(bytes / 1024, { maximumFractionDigits: 1 }) });
        return t("materials.units.MB", { value: formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 }) });
    };

    return (
        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Folder className="w-4 h-4 text-primary" /> {t("materials.title")}</h3>
            {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : isError ? (
                <p className="text-sm text-destructive">{getApiError(error, t("materials.loadFailed"))}</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("materials.empty")}</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
                        <li key={item.Id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.Name}</p>
                                <p className="text-xs text-muted-foreground">{formatSize(item.FileSizeBytes)}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                aria-label={t("materials.download", { name: item.Name })}
                                disabled={downloadingId === item.Id}
                                onClick={() => download(item)}
                            >
                                {downloadingId === item.Id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const CourseDetail = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation(["courses", "common", "billing"]);
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

    // Prerequisite and related courses are ids; the published catalog (same query as the Courses page, so usually
    // already cached) resolves them to cards. An id the caller cannot see (unpublished/deleted) is simply skipped.
    const needsCatalog = (detail?.PrerequisiteCourseIds?.length ?? 0) > 0 || (detail?.RelatedCourseIds?.length ?? 0) > 0;
    const catalogQuery = useQuery({
        queryKey: ["courses-catalog"],
        queryFn: async () => (await api.get<CourseSummary[]>("/Courses", { params: { status: "Published" } })).data,
        enabled: needsCatalog,
    });
    const catalogById = useMemo(
        () => new Map((catalogQuery.data ?? []).map((c) => [c.Id, c])),
        [catalogQuery.data]
    );
    const loading = courseQuery.isLoading || courseProgressLoading;
    // A purchase always mints an enrollment server-side, but the progress probe can 404 for a moment right after
    // checkout; owning the course is access in its own right, so it counts as "in".
    const enrolled = !!courseProgress || detail?.Owned === true;
    const contentUnlocked = detail?.ContentUnlocked !== false;
    // The three branches this page has to serve: free (unchanged), paid+owned, paid+not-owned.
    const isPaid = isPaidCourse(detail?.AccessModel, detail?.Pricing);
    const owned = detail?.Owned === true;
    const mustBuy = isPaid && !owned;
    const completedIds = useMemo(() => new Set(courseProgress?.CompletedLessonIds ?? []), [courseProgress]);

    /**
     * A chapter is locked when the server says so. On a free course every chapter shares the course-level verdict, so
     * this is the old `!ContentUnlocked` for every course that predates monetization; on a paid course it is per
     * chapter, which is what makes a preview chapter playable and a separately-bought chapter readable.
     */
    const chapterLocked = (ch: ChapterDto) => ch.IsLocked ?? !contentUnlocked;

    const chapters = useMemo<Chapter[]>(() => {
        if (!detail) return [];
        return [...(detail.Chapters ?? [])]
            .sort((a, b) => a.OrderIndex - b.OrderIndex)
            .map((ch) => {
                const locked = ch.IsLocked ?? !contentUnlocked;
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
                        IsLocked: locked,
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
                    IsLocked: locked,
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
        // Per-lesson, not per-course: a preview chapter on a paid course is playable without buying anything.
        const lesson = chapters.flatMap((ch) => ch.Lessons).find((l) => l.Id === lessonId);
        if (!lesson || lesson.IsLocked) return;
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

    /**
     * Every purchase action on this page is a *link* into `/checkout`, never an API call: enrolling in a paid course
     * the trainer does not own is refused server-side (403 `enrollment.purchase_required`), and that refusal is the
     * design, not something to route around.
     */
    const buyLink = (
        itemType: "Course" | "Track" | "Chapter",
        itemId: string,
        label: string,
        opts: { size?: "sm" | "lg" | "default"; testId?: string } = {}
    ) => (
        <Button asChild size={opts.size ?? "default"} className="gap-2">
            <Link to={checkoutHref(itemType, itemId)} data-testid={opts.testId}>
                <ShoppingCart className={opts.size === "lg" ? "w-5 h-5" : "w-4 h-4"} />
                {label}
            </Link>
        </Button>
    );

    const inTracks = (course.InTracks ?? []).filter((track) => !track.Owned);
    const tags = course.Tags ?? [];
    const outcomes = course.Outcomes ?? [];
    const prerequisites = (course.PrerequisiteCourseIds ?? [])
        .map((id) => catalogById.get(id))
        .filter((c): c is CourseSummary => !!c);
    const relatedCourses = (course.RelatedCourseIds ?? [])
        .map((id) => catalogById.get(id))
        .filter((c): c is CourseSummary => !!c);

    /** The price + buy action shown under a chapter of a paid course the trainer has not bought. */
    const chapterAction = (chapterId: string) => {
        if (!mustBuy) return undefined;
        const dto = (course.Chapters ?? []).find((c) => c.Id === chapterId);
        if (!dto) return undefined;
        if (dto.IsPreview) {
            return (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success" data-testid={`chapter-preview-${chapterId}`}>
                    {t("billing:price.preview")}
                </Badge>
            );
        }
        if (!chapterLocked(dto) || !dto.Pricing || dto.Pricing.IsFree) return undefined;
        return (
            <div className="flex items-center gap-3" data-testid={`chapter-buy-${chapterId}`}>
                <PriceTag pricing={dto.Pricing} size="sm" />
                {buyLink("Chapter", chapterId, t("billing:price.unlockChapter"), { size: "sm" })}
            </div>
        );
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

                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 -mt-3 mb-6" aria-label={t("detail.tagsLabel")} data-testid="course-tags">
                                    {tags.map((tag) => (
                                        <Badge key={tag} variant="secondary">{tag}</Badge>
                                    ))}
                                </div>
                            )}

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
                            <div className="flex flex-wrap items-center gap-4">
                                {mustBuy ? (
                                    /* Paid, not owned: price + a link into checkout. Never enrollInCourse. */
                                    <div className="flex flex-wrap items-center gap-4" data-testid="course-buy-action">
                                        <PriceTag pricing={course.Pricing} size="lg" />
                                        {buyLink("Course", course.Id, t("billing:price.buyNow"), { size: "lg", testId: "buy-course" })}
                                    </div>
                                ) : enrolled ? (
                                    <>
                                        {owned && <PriceTag owned size="lg" />}
                                        {nextLesson && (
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
                                        )}
                                    </>
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
                                    {mustBuy ? (
                                        t("detail.buyToStart")
                                    ) : enrolled ? (
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
                            {outcomes.length > 0 && (
                                <section className="rounded-2xl bg-card border border-border/50 shadow-soft p-5" data-testid="course-outcomes">
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <ListChecks className="w-5 h-5 text-primary" /> {t("detail.whatYouWillLearn")}
                                    </h2>
                                    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                                        {outcomes.map((outcome, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                                                <span>{outcome}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            <h2 className="text-xl font-semibold">{t("detail.courseContent")}</h2>
                            <div className="space-y-3">
                                {inTracks.map((track) => (
                                    <div
                                        key={track.Id}
                                        className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                                        data-testid={`in-track-${track.Id}`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                            <RouteIcon className="w-5 h-5 text-accent" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{t("detail.inTrackTitle", { track: track.Title })}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {t("detail.inTrackDesc", { count: track.CoursesCount })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <PriceTag pricing={track.Pricing} showFree={false} />
                                            {buyLink("Track", track.Id, t("detail.buyTrack"), { testId: `buy-track-${track.Id}` })}
                                        </div>
                                    </div>
                                ))}
                                {!contentUnlocked && (
                                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Lock className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{mustBuy ? t("detail.buyToUnlockTitle") : t("detail.unlockTitle")}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {mustBuy ? t("detail.buyToUnlockDesc") : t("detail.unlockDesc")}
                                            </p>
                                        </div>
                                        {mustBuy ? (
                                            <div className="flex items-center gap-3">
                                                <PriceTag pricing={course.Pricing} />
                                                {buyLink("Course", course.Id, t("billing:price.unlockCourse"), { testId: "buy-course-banner" })}
                                            </div>
                                        ) : (
                                            <Button onClick={handleEnroll} disabled={enrolling} className="gap-2">
                                                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                                                {t("detail.enrollNow")}
                                            </Button>
                                        )}
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
                                        action={chapterAction(chapter.Id)}
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

                            {/* Prerequisites: the server refuses a self-enroll until every one is completed. */}
                            {prerequisites.length > 0 && (
                                <div className="rounded-2xl bg-card border border-warning/30 shadow-soft p-5" data-testid="course-prerequisites">
                                    <h3 className="font-semibold mb-1 flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-warning" /> {t("detail.prerequisites")}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-3">{t("detail.prerequisitesDesc")}</p>
                                    <ul className="space-y-2">
                                        {prerequisites.map((c) => (
                                            <li key={c.Id}>
                                                <Link to={`/courses/${c.Id}`} className="text-sm font-medium text-primary hover:underline">
                                                    {c.Title}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Course materials (enrolled trainers only) */}
                            {enrolled && (
                                <Can permission={PERMISSIONS.materialsView}>
                                    <CourseMaterials courseId={course.Id} />
                                </Can>
                            )}
                        </div>
                    </div>

                    {/* Related courses: optional recommendations, never a requirement. */}
                    {relatedCourses.length > 0 && (
                        <section className="space-y-4" data-testid="related-courses">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Link2 className="w-5 h-5 text-primary" /> {t("detail.relatedCourses")}
                            </h2>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relatedCourses.map((c) => (
                                    <CourseCardEnhanced key={c.Id} course={toCourseCard(c)} onClick={() => navigate(`/courses/${c.Id}`)} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main >
        </div >
    );
};

export default CourseDetail;
