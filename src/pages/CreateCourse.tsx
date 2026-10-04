import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { lessonTypeLabel } from "@/hooks/useCourseEditor";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCourses } from "@/hooks/useCourses";
import { useCourseEditor, Chapter } from "@/hooks/useCourseEditor";
import { useNavigate } from "react-router-dom";
import api, { getApiError } from "@/lib/api";
import { categoryLabels, type CourseCategory } from "@/components/courses";
import { TagsInput, OutcomesInput } from "@/components/instructor/CourseMetadataFields";
import { cleanTags, cleanOutcomes } from "@/components/instructor/courseMetadata";
import { useCourseDepartmentOptions, NO_DEPARTMENT } from "@/hooks/useDepartments";
import {
  BookOpen, Sparkles, Upload, FileQuestion, CheckCircle, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, GripVertical,
  Video, FileText, HelpCircle, X
} from "lucide-react";

const COURSE_CATEGORIES = Object.keys(categoryLabels) as CourseCategory[];

const STEPS = [
  { key: "info", icon: BookOpen },
  { key: "curriculum", icon: GripVertical },
  { key: "materials", icon: Upload },
  { key: "quizzes", icon: FileQuestion },
  { key: "publish", icon: CheckCircle },
];

const LESSON_TYPE_ICON: Record<string, typeof Video> = { video: Video, reading: FileText, text: FileText, quiz: HelpCircle };

interface CourseOutlineResponse {
  Title: string;
  Chapters: { Title: string; Lessons: string[] }[];
  Generator: string;
}

const CreateCourse = () => {
  const { t } = useTranslation(["instructor", "courses"]);
  const { formatNumber } = useFormatters();
  const [step, setStep] = useState(0);
  const [courseInfo, setCourseInfo] = useState({ title: "", description: "", category: "", level: "beginner", imageUrl: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState(NO_DEPARTMENT);
  const { data: departments = [] } = useCourseDepartmentOptions();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const { toast } = useToast();
  const { createCourse, publishCourse } = useCourses();
  const { saveCurriculum, uploadMedia, uploading } = useCourseEditor();
  const navigate = useNavigate();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadMedia(file, "courses");
    if (url) setCourseInfo((prev) => ({ ...prev, imageUrl: url }));
  };

  const generateOutline = async () => {
    if (!courseInfo.title) { toast({ title: t("createCourse.titleRequired"), variant: "destructive" }); return; }
    setAiLoading(true);
    try {
      const { data } = await api.post<CourseOutlineResponse>("/AI/course-outline", {
        Topic: courseInfo.title,
        Description: courseInfo.description || undefined,
      });
      const suggested: Chapter[] = (data.Chapters || []).map((ch) => ({
        Id: crypto.randomUUID(),
        Title: ch.Title,
        Lessons: (ch.Lessons || []).map((title) => ({
          Id: crypto.randomUUID(),
          Title: title,
          LessonType: "Reading" as const,
        })),
      }));
      setChapters(suggested);
      toast({ title: t("createCourse.outlineReady"), description: t("createCourse.outlineReadyDesc", { count: suggested.length }) });
    } catch (e) {
      toast({ title: t("createCourse.outlineFailed"), description: getApiError(e), variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = async () => {
    if (step === 0 && !courseInfo.title) { toast({ title: t("createCourse.courseTitleRequired"), variant: "destructive" }); return; }
    if (step === 0 && !createdCourseId) {
      const { data, error } = await createCourse({
        Title: courseInfo.title,
        Description: courseInfo.description,
        Category: courseInfo.category,
        Level: courseInfo.level,
        ImageUrl: courseInfo.imageUrl || null,
        Tags: cleanTags(tags),
        Outcomes: cleanOutcomes(outcomes),
        DepartmentId: departmentId === NO_DEPARTMENT ? undefined : departmentId,
      });
      if (error || !data) return;
      setCreatedCourseId(data.Id);
    }
    if (step === 1 && createdCourseId && chapters.length > 0) {
      const saved = await saveCurriculum(createdCourseId, chapters);
      if (!saved) return;
      setChapters(saved);
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const handlePublish = async () => {
    if (!createdCourseId) return;
    const { error } = await publishCourse(createdCourseId);
    if (error) {
      toast({ title: t("createCourse.publishFailed"), description: getApiError(error), variant: "destructive" });
      return;
    }
    toast({ title: t("createCourse.published"), description: t("createCourse.publishedDesc") });
    navigate("/instructor/courses");
  };

  const addChapter = () => setChapters((c) => [...c, { Id: crypto.randomUUID(), Title: t("createCourse.newChapter"), Lessons: [] }]);
  const addLesson = (chIdx: number) => {
    setChapters((prev) => prev.map((ch, i) => i === chIdx ? { ...ch, Lessons: [...ch.Lessons, { Id: crypto.randomUUID(), Title: t("createCourse.newLesson"), LessonType: "Reading" }] } : ch));
  };
  const removeChapter = (idx: number) => setChapters((c) => c.filter((_, i) => i !== idx));
  const removeLesson = (chIdx: number, lIdx: number) => {
    setChapters((prev) => prev.map((ch, i) => i === chIdx ? { ...ch, Lessons: ch.Lessons.filter((_, j) => j !== lIdx) } : ch));
  };
  const updateChapterTitle = (idx: number, title: string) => setChapters((c) => c.map((ch, i) => i === idx ? { ...ch, Title: title } : ch));
  const updateLessonTitle = (chIdx: number, lIdx: number, title: string) => {
    setChapters((prev) => prev.map((ch, i) => i === chIdx ? { ...ch, Lessons: ch.Lessons.map((l, j) => j === lIdx ? { ...l, Title: title } : l) } : ch));
  };

  return (
    <InstructorPageLayout>
      {/* Step indicators */}
      <section className="animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("createCourse.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("createCourse.stepOf", { current: formatNumber(step + 1), total: formatNumber(5), label: t(`createCourse.steps.${STEPS[step].key}`) })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : formatNumber(i + 1)}
              </div>
              <span className={`text-xs hidden sm:inline ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{t(`createCourse.steps.${s.key}`)}</span>
              {i < 4 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <Progress value={((step + 1) / 5) * 100} className="h-1.5 mb-6" />
      </section>

      {/* Step 0: Course Info */}
      {step === 0 && (
        <Card className="shadow-soft border-border/50 animate-slide-up">
          <CardHeader>
            <CardTitle>{t("createCourse.info.title")}</CardTitle>
            <CardDescription>{t("createCourse.info.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("createCourse.info.titleLabel")}</label>
              <Input value={courseInfo.title} onChange={(e) => setCourseInfo({ ...courseInfo, title: e.target.value })} placeholder={t("createCourse.info.titlePlaceholder")} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("createCourse.info.descriptionLabel")}</label>
              <Textarea value={courseInfo.description} onChange={(e) => setCourseInfo({ ...courseInfo, description: e.target.value })} placeholder={t("createCourse.info.descriptionPlaceholder")} rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("createCourse.info.image")}</label>
              <div className="flex items-center gap-4">
                {courseInfo.imageUrl ? (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border shrink-0">
                    <img src={courseInfo.imageUrl} alt={courseInfo.title || t("createCourse.info.image")} className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 end-1 h-5 w-5"
                      aria-label={t("createCourse.info.removeImage")}
                      onClick={() => setCourseInfo((prev) => ({ ...prev, imageUrl: "" }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <Button type="button" variant="outline" size="sm" className="relative" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
                    {uploading ? t("createCourse.info.uploading") : courseInfo.imageUrl ? t("createCourse.info.changeImage") : t("createCourse.info.uploadImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">{t("createCourse.info.imageHint")}</p>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="course-category" className="text-sm font-medium mb-1 block">{t("createCourse.info.category")}</label>
                <Select value={courseInfo.category} onValueChange={(v) => setCourseInfo({ ...courseInfo, category: v })}>
                  <SelectTrigger id="course-category"><SelectValue placeholder={t("createCourse.info.categoryPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {COURSE_CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>{t(`courses:category.${key}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("createCourse.info.level")}</label>
                <Select value={courseInfo.level} onValueChange={(v) => setCourseInfo({ ...courseInfo, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t("level.beginner")}</SelectItem>
                    <SelectItem value="intermediate">{t("level.intermediate")}</SelectItem>
                    <SelectItem value="advanced">{t("level.advanced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label htmlFor="course-department" className="text-sm font-medium mb-1 block">{t("courseMeta.department.label")}</label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="course-department"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>{t("courseMeta.department.none")}</SelectItem>
                  {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("courseMeta.department.help")}</p>
            </div>
            <TagsInput id="course-tags" value={tags} onChange={setTags} />
            <OutcomesInput value={outcomes} onChange={setOutcomes} />
          </CardContent>
        </Card>
      )}

      {/* Step 1: Curriculum */}
      {step === 1 && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("createCourse.curriculum.title")}</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generateOutline} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Sparkles className="w-4 h-4 me-2" />}
                {t("createCourse.curriculum.suggest")}
              </Button>
              <Button variant="outline" onClick={addChapter}><Plus className="w-4 h-4 me-2" /> {t("createCourse.curriculum.addChapter")}</Button>
            </div>
          </div>
          {chapters.length === 0 && (
            <Card className="shadow-soft border-border/50 p-8 text-center">
              <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t("createCourse.curriculum.empty")}</p>
            </Card>
          )}
          {chapters.map((ch, chIdx) => (
            <Card key={ch.Id} className="shadow-soft border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{t("createCourse.curriculum.chapterShort", { number: formatNumber(chIdx + 1) })}</Badge>
                  <Input value={ch.Title} onChange={(e) => updateChapterTitle(chIdx, e.target.value)} className="font-semibold text-sm h-8" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={t("createCourse.curriculum.deleteChapter")} onClick={() => removeChapter(chIdx)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {ch.Lessons.map((lesson, lIdx) => {
                  const LIcon = LESSON_TYPE_ICON[lesson.LessonType.toLowerCase()] || FileText;
                  return (
                    <div key={lesson.Id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <LIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input value={lesson.Title} onChange={(e) => updateLessonTitle(chIdx, lIdx, e.target.value)} className="h-7 text-sm" />
                      <Badge variant="secondary" className="text-xs">{lessonTypeLabel(t, lesson.LessonType)}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("createCourse.curriculum.deleteLesson")} onClick={() => removeLesson(chIdx, lIdx)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => addLesson(chIdx)}><Plus className="w-3 h-3 me-1" /> {t("createCourse.curriculum.addLesson")}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Materials */}
      {step === 2 && (
        <Card className="shadow-soft border-border/50 animate-slide-up">
          <CardHeader>
            <CardTitle>{t("createCourse.materials.title")}</CardTitle>
            <CardDescription>{t("createCourse.materials.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">{t("createCourse.materials.drop")}</p>
              <p className="text-xs text-muted-foreground">{t("createCourse.materials.supports")}</p>
              <Button variant="outline" className="mt-4">{t("createCourse.materials.browse")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Quizzes */}
      {step === 3 && (
        <Card className="shadow-soft border-border/50 animate-slide-up">
          <CardHeader>
            <CardTitle>{t("createCourse.quizzes.title")}</CardTitle>
            <CardDescription>{t("createCourse.quizzes.description")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t("createCourse.quizzes.hint")}</p>
            <Button variant="outline" onClick={() => navigate("/instructor/quizzes")}>
              <Sparkles className="w-4 h-4 me-2" /> {t("createCourse.quizzes.go")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Publish */}
      {step === 4 && (
        <Card className="shadow-soft border-border/50 animate-slide-up">
          <CardHeader>
            <CardTitle>{t("createCourse.publish.title")}</CardTitle>
            <CardDescription>{t("createCourse.publish.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("createCourse.publish.titleField")}</p>
                <p className="font-medium">{courseInfo.title || "—"}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("createCourse.publish.level")}</p>
                <p className="font-medium">{t(`level.${courseInfo.level}`)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("createCourse.publish.chapters")}</p>
                <p className="font-medium">{formatNumber(chapters.length)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("createCourse.publish.lessons")}</p>
                <p className="font-medium">{formatNumber(chapters.reduce((sum, ch) => sum + ch.Lessons.length, 0))}</p>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button onClick={handlePublish} className="gradient-accent text-white shadow-glow-accent px-8">
                <CheckCircle className="w-4 h-4 me-2" /> {t("createCourse.publish.publish")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> {t("createCourse.previous")}
        </Button>
        {step < 4 && (
          <Button onClick={handleNext} className="gradient-accent text-white shadow-glow-accent">
            {t("createCourse.next")} <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
          </Button>
        )}
      </div>
    </InstructorPageLayout>
  );
};

export default CreateCourse;
