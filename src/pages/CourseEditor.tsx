import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { courseStatusLabel } from "@/hooks/useInstructorStats";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Loader2, Save, FileText, Video as VideoIcon, X, ImageIcon } from "lucide-react";
import { useCourseEditor, Chapter } from "@/hooks/useCourseEditor";
import { ChapterList } from "@/components/instructor/ChapterList";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useCourses } from "@/hooks/useCourses";
import { useEffect } from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Eye, EyeOff, Lock, Unlock, Trash2, Archive, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEnrolledTrainers } from "@/hooks/useEnrolledTrainers";
import api, { getApiError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { CourseSummary } from "@/hooks/useTrainerApi";
import { TagsInput, OutcomesInput, CoursePicker } from "@/components/instructor/CourseMetadataFields";
import { cleanTags, cleanOutcomes } from "@/components/instructor/courseMetadata";
import { CertificateConfigForm } from "@/components/certificates/CertificateConfigForm";
import { isCertificateConfigValid, useSetCourseCertificateConfig, type CertificateConfig } from "@/hooks/useCertificates";
import { useQuizListQuery } from "@/hooks/useQuizzes";
import { CourseAssistantsPanel } from "@/components/instructor/CourseAssistantsPanel";
import { useCourseDepartmentOptions, NO_DEPARTMENT } from "@/hooks/useDepartments";

const CourseEditor = () => {
    const { t } = useTranslation(["instructor", "certificates"]);
    const { formatDate, formatPercent } = useFormatters();
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState("info");

    const [courseInfo, setCourseInfo] = useState({
        Title: "",
        Description: "",
        Category: "",
        Level: "beginner",
        MinApplicants: 0,
        ImageUrl: "",
        Status: "Draft" as "Draft" | "Published" | "Archived"
    });

    const [tags, setTags] = useState<string[]>([]);
    const [outcomes, setOutcomes] = useState<string[]>([]);
    const [prerequisiteIds, setPrerequisiteIds] = useState<string[]>([]);
    const [relatedIds, setRelatedIds] = useState<string[]>([]);
    const [departmentId, setDepartmentId] = useState(NO_DEPARTMENT);
    const { data: departments = [], isLoading: departmentsLoading } = useCourseDepartmentOptions();
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loadingCourse, setLoadingCourse] = useState(true);
    const [certificateConfig, setCertificateConfig] = useState<CertificateConfig>({ CertificateRequiresExam: false, CertificateExamQuizId: null });
    const courseQuizzes = useQuizListQuery(courseId);
    const setCertificate = useSetCourseCertificateConfig();

    const { updateCourse, getCourseById, deleteCourse } = useCourses();
    const { trainers: enrolledTrainers, loading: trainersLoading, error: trainersError } = useEnrolledTrainers(courseId);
    const { analyzeSyllabus, uploadMedia, saveCurriculum, fetchCurriculum, analyzing, analysisError, uploading, loading: savingCurriculum } = useCourseEditor();
    const { toast } = useToast();

    // The published catalog feeds both course pickers (same query/key as the trainer catalog, so it is shared in cache).
    const catalogQuery = useQuery({
        queryKey: ["courses-catalog"],
        queryFn: async () => (await api.get<CourseSummary[]>("/Courses", { params: { status: "Published" } })).data,
    });
    const courseOptions = (catalogQuery.data ?? [])
        .filter((c) => c.Id !== courseId)
        .map((c) => ({ Id: c.Id, Title: c.Title }));

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const url = await uploadMedia(file, "courses");
        if (url) setCourseInfo((prev) => ({ ...prev, ImageUrl: url }));
    };

    useEffect(() => {
        const loadData = async () => {
            if (!courseId) return;

            setLoadingCourse(true);
            try {
                const { course } = await getCourseById(courseId);
                if (course) {
                    setCourseInfo({
                        Title: course.Title || "",
                        Description: course.Description || "",
                        Category: course.Category || "",
                        Level: course.Level?.toLowerCase() || "beginner",
                        MinApplicants: 0,
                        ImageUrl: course.ImageUrl || "",
                        Status: course.Status || "Draft"
                    });
                    setTags(course.Tags ?? []);
                    setOutcomes(course.Outcomes ?? []);
                    setPrerequisiteIds(course.PrerequisiteCourseIds ?? []);
                    setRelatedIds(course.RelatedCourseIds ?? []);
                    setDepartmentId(course.DepartmentId || NO_DEPARTMENT);
                    setCertificateConfig({
                        CertificateRequiresExam: course.CertificateRequiresExam ?? false,
                        CertificateExamQuizId: course.CertificateExamQuizId ?? null,
                    });
                }

                const curr = await fetchCurriculum(courseId);
                if (curr) {
                    setChapters(curr);
                }
            } catch (error) {
                console.error("Error loading course data:", error);
            } finally {
                setLoadingCourse(false);
            }
        };

        loadData();
    }, [courseId, getCourseById, fetchCurriculum]);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const structure = await analyzeSyllabus(file);
        e.target.value = "";
        if (structure) {
            setChapters(structure);
            setActiveTab("curriculum");
        }
    };

    const handleSaveInfo = async () => {
        if (!courseId) return;
        const cleanedTags = cleanTags(tags);
        const cleanedOutcomes = cleanOutcomes(outcomes);
        const { error } = await updateCourse(courseId, {
            Title: courseInfo.Title,
            Description: courseInfo.Description,
            Category: courseInfo.Category,
            Level: courseInfo.Level,
            ImageUrl: courseInfo.ImageUrl || null,
            Status: courseInfo.Status,
            Tags: cleanedTags,
            Outcomes: cleanedOutcomes,
            PrerequisiteCourseIds: prerequisiteIds,
            RelatedCourseIds: relatedIds,
            // "" clears the department on the server; null would mean "leave unchanged".
            DepartmentId: departmentId === NO_DEPARTMENT ? "" : departmentId,
        });
        if (error) {
            // e.g. 400 course.related_courses_invalid; the server's message is already localized.
            toast({ variant: "destructive", title: t("courseMeta.saveFailed"), description: getApiError(error) });
            return;
        }
        setTags(cleanedTags);
        setOutcomes(cleanedOutcomes);
    };

    const handleSaveCertificate = async () => {
        // The form already disables Save in this state; this is the belt to its braces.
        if (!courseId || !isCertificateConfigValid(certificateConfig)) return;
        try {
            await setCertificate.mutateAsync({ courseId, config: certificateConfig });
            toast({ title: t("certificates:config.saved") });
        } catch (error) {
            // e.g. 400 certificate.exam_quiz_invalid; the server's message is already localized.
            toast({ variant: "destructive", title: t("certificates:config.saveFailed"), description: getApiError(error) });
        }
    };

    const handleSaveCurriculum = async () => {
        if (!courseId) return;
        const saved = await saveCurriculum(courseId, chapters);
        if (saved) setChapters(saved);
    };

    const handleArchiveCourse = async () => {
        if (!courseId) return;
        const { error } = await updateCourse(courseId, { Status: "Archived" });
        if (!error) setCourseInfo(prev => ({ ...prev, Status: "Archived" }));
        else toast({ variant: "destructive", title: t("courseEditor.settings.archiveFailed"), description: getApiError(error) });
    };

    const handleDeleteCourse = async () => {
        if (!courseId) return;
        if (!window.confirm(t("courseEditor.settings.deleteConfirm"))) return;
        const { error } = await deleteCourse(courseId);
        if (error) {
            toast({ variant: "destructive", title: t("courseEditor.settings.deleteFailed"), description: getApiError(error, t("courseEditor.settings.deleteFailedDesc")) });
            return;
        }
        navigate("/instructor/courses");
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ms-20" : "ms-64"
            )}>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate("/instructor/courses")}>
                                <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                                {t("courseEditor.back")}
                            </Button>
                            <h1 className="text-2xl font-bold">{t("courseEditor.title")}</h1>
                        </div>
                        {loadingCourse && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="info">{t("courseEditor.tabs.info")}</TabsTrigger>
                            <TabsTrigger value="curriculum">{t("courseEditor.tabs.curriculum")}</TabsTrigger>
                            <TabsTrigger value="trainers">{t("courseEditor.tabs.trainers")}</TabsTrigger>
                            <TabsTrigger value="certificate">{t("courseEditor.tabs.certificate")}</TabsTrigger>
                            <TabsTrigger value="assistants">{t("courseEditor.tabs.assistants")}</TabsTrigger>
                            <TabsTrigger value="settings">{t("courseEditor.tabs.settings")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="info" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("courseEditor.info.title")}</CardTitle>
                                    <CardDescription>{t("courseEditor.info.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">{t("courseEditor.info.courseTitle")}</Label>
                                        <Input
                                            id="title"
                                            value={courseInfo.Title}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, Title: e.target.value })}
                                            placeholder={t("courseEditor.info.titlePlaceholder")}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="description">{t("courseEditor.info.descriptionLabel")}</Label>
                                        <Textarea
                                            id="description"
                                            value={courseInfo.Description}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, Description: e.target.value })}
                                            rows={4}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="category">{t("courseEditor.info.category")}</Label>
                                            <Input
                                                id="category"
                                                value={courseInfo.Category}
                                                onChange={(e) => setCourseInfo({ ...courseInfo, Category: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="level">{t("courseEditor.info.level")}</Label>
                                            <Select
                                                value={courseInfo.Level}
                                                onValueChange={(val) => setCourseInfo({ ...courseInfo, Level: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t("courseEditor.info.selectLevel")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="beginner">{t("level.beginner")}</SelectItem>
                                                    <SelectItem value="intermediate">{t("level.intermediate")}</SelectItem>
                                                    <SelectItem value="advanced">{t("level.advanced")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="course-department">{t("courseMeta.department.label")}</Label>
                                        <Select value={departmentId} onValueChange={setDepartmentId}>
                                            <SelectTrigger id="course-department"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NO_DEPARTMENT}>{t("courseMeta.department.none")}</SelectItem>
                                                {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                                {/* Keep a department the list no longer offers (e.g. just deleted) selectable rather than blank. */}
                                                {!departmentsLoading && departmentId !== NO_DEPARTMENT && !departments.some((d) => d.Id === departmentId) && (
                                                    <SelectItem value={departmentId}>{t("courseMeta.department.unknown")}</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-sm text-muted-foreground">{t("courseMeta.department.help")}</p>
                                    </div>

                                    <TagsInput id="course-tags" value={tags} onChange={setTags} />

                                    <OutcomesInput value={outcomes} onChange={setOutcomes} />

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <CoursePicker
                                            id="course-prerequisites"
                                            title={t("courseMeta.prerequisites.title")}
                                            help={t("courseMeta.prerequisites.help")}
                                            options={courseOptions}
                                            value={prerequisiteIds}
                                            onChange={setPrerequisiteIds}
                                            excludeIds={relatedIds}
                                            loading={catalogQuery.isLoading}
                                            className="border-warning/40 bg-warning/5"
                                        />
                                        <CoursePicker
                                            id="course-related"
                                            title={t("courseMeta.related.title")}
                                            help={t("courseMeta.related.help")}
                                            options={courseOptions}
                                            value={relatedIds}
                                            onChange={setRelatedIds}
                                            excludeIds={prerequisiteIds}
                                            loading={catalogQuery.isLoading}
                                            className="border-primary/30 bg-primary/5"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>{t("courseEditor.info.image")}</Label>
                                        <div className="flex items-center gap-4">
                                            {courseInfo.ImageUrl ? (
                                                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border shrink-0">
                                                    <img src={courseInfo.ImageUrl} alt={courseInfo.Title || t("courseEditor.info.image")} className="w-full h-full object-cover" />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 end-1 h-5 w-5"
                                                        aria-label={t("courseEditor.info.removeImage")}
                                                        onClick={() => setCourseInfo((prev) => ({ ...prev, ImageUrl: "" }))}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="w-32 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                                                    <ImageIcon className="w-6 h-6" />
                                                </div>
                                            )}
                                            <div>
                                                <Button type="button" variant="outline" size="sm" className="relative" disabled={uploading}>
                                                    {uploading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
                                                    {uploading ? t("courseEditor.info.uploading") : courseInfo.ImageUrl ? t("courseEditor.info.changeImage") : t("courseEditor.info.uploadImage")}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={handleImageUpload}
                                                        disabled={uploading}
                                                    />
                                                </Button>
                                                <p className="text-sm text-muted-foreground mt-1">{t("courseEditor.info.imageHint")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="minApplicants">{t("courseEditor.info.minApplicants")}</Label>
                                        <Input
                                            id="minApplicants"
                                            type="number"
                                            min="0"
                                            value={courseInfo.MinApplicants}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, MinApplicants: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                            className="max-w-[200px]"
                                        />
                                        <p className="text-sm text-muted-foreground">{t("courseEditor.info.minApplicantsHint")}</p>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <Label className="mb-2 block">{t("courseEditor.info.syllabus")}</Label>
                                        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            {analyzing ? (
                                                <div className="flex items-center gap-2 text-primary">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>{t("courseEditor.info.analyzing")}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-medium">{t("courseEditor.info.uploadText")}</p>
                                                    <p className="text-xs text-muted-foreground mb-4">{t("courseEditor.info.uploadHint")}</p>
                                                    <div className="relative">
                                                        <Input
                                                            type="file"
                                                            accept=".txt,.md"
                                                            className="max-w-xs cursor-pointer"
                                                            onChange={handlePdfUpload}
                                                        />
                                                    </div>
                                                    {analysisError && (
                                                        <p className="text-sm text-destructive mt-3">{analysisError}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <Button onClick={handleSaveInfo}>
                                            <Save className="w-4 h-4 me-2" />
                                            {t("courseEditor.info.save")}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="curriculum">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("courseEditor.curriculum.title")}</CardTitle>
                                    <CardDescription>{t("courseEditor.curriculum.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <ChapterList
                                        chapters={chapters}
                                        onUpdateChapters={setChapters}
                                        onUploadMedia={uploadMedia}
                                    />
                                    <div className="flex justify-end pt-4 border-t">
                                        <Button
                                            onClick={handleSaveCurriculum}
                                            disabled={savingCurriculum}
                                        >
                                            {savingCurriculum ? (
                                                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4 me-2" />
                                            )}
                                            {t("courseEditor.curriculum.save")}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="trainers">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("courseEditor.trainers.title")}</CardTitle>
                                    <CardDescription>{t("courseEditor.trainers.description")}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t("courseEditor.trainers.trainer")}</TableHead>
                                                <TableHead>{t("courseEditor.trainers.enrolledDate")}</TableHead>
                                                <TableHead>{t("courseEditor.trainers.progress")}</TableHead>
                                                <TableHead>{t("courseEditor.trainers.status")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {trainersLoading && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline text-primary" /></TableCell></TableRow>
                                            )}
                                            {!trainersLoading && trainersError && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-destructive">{getApiError(trainersError, t("courseEditor.trainers.loadFailed"))}</TableCell></TableRow>
                                            )}
                                            {!trainersLoading && !trainersError && enrolledTrainers.length === 0 && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("courseEditor.trainers.empty")}</TableCell></TableRow>
                                            )}
                                            {enrolledTrainers.map((trainer) => (
                                                <TableRow key={trainer.TrainerId}>
                                                    <TableCell className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={trainer.AvatarUrl || undefined} />
                                                            <AvatarFallback>{(trainer.FullName ?? "").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{trainer.FullName ?? t("common:deletedUser")}</p>
                                                            <p className="text-xs text-muted-foreground" dir="ltr">{trainer.Email}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{formatDate(trainer.EnrolledAt)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-full max-w-[100px] bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary"
                                                                    style={{ width: `${trainer.ProgressPercentage}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{formatPercent(Math.round(trainer.ProgressPercentage))}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={trainer.CompletedAt ? "default" : "secondary"}>
                                                            {trainer.CompletedAt ? t("courseEditor.trainers.completed") : t("courseEditor.trainers.active")}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="certificate">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("certificates:config.title")}</CardTitle>
                                    <CardDescription>{t("certificates:config.description")}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CertificateConfigForm
                                        idPrefix="course"
                                        value={certificateConfig}
                                        onChange={setCertificateConfig}
                                        onSave={handleSaveCertificate}
                                        saving={setCertificate.isPending}
                                        quizzes={courseQuizzes.data ?? []}
                                        quizzesLoading={courseQuizzes.isLoading}
                                        quizzesError={courseQuizzes.isError}
                                        emptyText={t("certificates:config.noQuizzes")}
                                        quizEditHref="/instructor/quizzes"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assistants">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("assistants.title")}</CardTitle>
                                    <CardDescription>{t("assistants.description")}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {courseId && <CourseAssistantsPanel courseId={courseId} />}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>{t("courseEditor.settings.visibility")}</CardTitle>
                                            <CardDescription>{t("courseEditor.settings.visibilityDesc")}</CardDescription>
                                        </div>
                                        <Badge variant={courseInfo.Status === "Published" ? "default" : "secondary"}>
                                            {courseStatusLabel(t, courseInfo.Status)}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                {courseInfo.Status === "Published" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                <Label className="text-base">{t("courseEditor.settings.publish")}</Label>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {t("courseEditor.settings.publishHint")}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={courseInfo.Status === "Published"}
                                            onCheckedChange={(checked) => setCourseInfo({ ...courseInfo, Status: checked ? "Published" : "Draft" })}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-destructive/50">
                                <CardHeader>
                                    <CardTitle className="text-destructive">{t("courseEditor.settings.danger")}</CardTitle>
                                    <CardDescription>{t("courseEditor.settings.dangerDesc")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t("courseEditor.settings.warning")}</AlertTitle>
                                        <AlertDescription>
                                            {t("courseEditor.settings.warningDesc")}
                                        </AlertDescription>
                                    </Alert>

                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <p className="font-medium">{t("courseEditor.settings.archiveCourse")}</p>
                                            <p className="text-sm text-muted-foreground">{t("courseEditor.settings.archiveHint")}</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="text-warning hover:text-warning border-warning/50 hover:bg-warning/10"
                                            onClick={handleArchiveCourse}
                                        >
                                            <Archive className="w-4 h-4 me-2" />
                                            {t("courseEditor.settings.archive")}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <p className="font-medium text-destructive">{t("courseEditor.settings.deleteCourse")}</p>
                                            <p className="text-sm text-muted-foreground">{t("courseEditor.settings.deleteHint")}</p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteCourse}
                                        >
                                            <Trash2 className="w-4 h-4 me-2" />
                                            {t("courseEditor.settings.deleteCourse")}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main >
        </div >
    );
};

export default CourseEditor;
