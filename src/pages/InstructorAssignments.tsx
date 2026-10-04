import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import {
  ClipboardList, Plus, Clock, Users, CheckCircle, Loader2, AlertCircle, Trash2, Paperclip, X, Download, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import {
  useAssignmentsQuery,
  useCreateAssignment,
  useDeleteAssignment,
  useUploadAssignmentAttachment,
  useSubmissionsQuery,
  useGradeSubmission,
  useDownloadAssignmentAttachment,
  useDownloadSubmissionFile,
  type Assignment,
  type Attachment,
  type AssignmentSubmission,
} from "@/hooks/useAssignments";

const ALL = "all";

const statusBadgeClass: Record<string, string> = {
  submitted: "bg-primary/10 text-primary",
  late: "bg-warning/10 text-warning",
  graded: "bg-success/10 text-success",
};

const SubmissionRow = ({ assignment, submission }: { assignment: Assignment; submission: AssignmentSubmission }) => {
  const { t } = useTranslation("instructor");
  const { formatDateTime } = useFormatters();
  const { toast } = useToast();
  const gradeSubmission = useGradeSubmission();
  const { download, downloadingUrl } = useDownloadSubmissionFile();
  const [score, setScore] = useState(submission.Score?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.Feedback ?? "");

  const handleGrade = async () => {
    const parsed = Number(score);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > assignment.MaxScore) return;
    try {
      await gradeSubmission.mutateAsync({
        assignmentId: assignment.Id,
        submissionId: submission.Id,
        body: { Score: parsed, Feedback: feedback.trim() || undefined },
      });
      toast({ title: t("assignments.submissionsPanel.graded") });
    } catch (err) {
      toast({ variant: "destructive", title: t("assignments.submissionsPanel.gradeFailed"), description: getApiError(err) });
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-sm">{submission.TrainerName ?? t("common:deletedUser")}</span>
          <Badge className={statusBadgeClass[submission.Status] ?? ""}>{t(`assignments.submissionsPanel.status.${submission.Status}`)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{t("assignments.submissionsPanel.submittedOn", { date: formatDateTime(submission.SubmittedAt) })}</p>

        <div className="text-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("assignments.submissionsPanel.text")}</p>
          <p className="whitespace-pre-wrap">{submission.Text || t("assignments.submissionsPanel.noText")}</p>
        </div>

        {submission.Files.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("assignments.submissionsPanel.files")}</p>
            {submission.Files.map((f) => (
              <button
                key={f.Url}
                type="button"
                className="flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
                disabled={downloadingUrl === f.Url}
                onClick={() => download(assignment.Id, submission.Id, f)}
              >
                {downloadingUrl === f.Url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {f.Name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[7rem_1fr] gap-3 items-start pt-2 border-t">
          <div className="space-y-1">
            <Label htmlFor={`score-${submission.Id}`} className="text-xs">{t("assignments.submissionsPanel.score")}</Label>
            <Input
              id={`score-${submission.Id}`}
              type="number"
              min={0}
              max={assignment.MaxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`feedback-${submission.Id}`} className="text-xs">{t("assignments.submissionsPanel.feedback")}</Label>
            <Textarea
              id={`feedback-${submission.Id}`}
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t("assignments.submissionsPanel.feedbackPlaceholder")}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleGrade} disabled={gradeSubmission.isPending || score === ""}>
            {gradeSubmission.isPending && <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" />}
            {t("assignments.submissionsPanel.submitGrade")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const SubmissionsPanel = ({ assignment }: { assignment: Assignment }) => {
  const { t } = useTranslation("instructor");
  const { data: submissions, isLoading, isError, error } = useSubmissionsQuery(assignment.Id);
  return (
    <div className="space-y-3 mt-4">
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-center text-destructive py-10">{getApiError(error, t("assignments.submissionsPanel.loadFailed"))}</p>
      ) : !submissions || submissions.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">{t("assignments.submissionsPanel.empty")}</p>
      ) : (
        submissions.map((s) => <SubmissionRow key={s.Id} assignment={assignment} submission={s} />)
      )}
    </div>
  );
};

const InstructorAssignments = () => {
  const { t } = useTranslation(["instructor", "common"]);
  const { formatDate } = useFormatters();
  const { toast } = useToast();
  const { data: courses = [] } = useMyCoursesQuery();
  const [courseFilter, setCourseFilter] = useState<string>(ALL);
  const { data: assignments = [], isLoading, isError, error } = useAssignmentsQuery(courseFilter !== ALL ? courseFilter : undefined);
  const { download: downloadAttachment, downloadingUrl } = useDownloadAssignmentAttachment();

  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const uploadAttachment = useUploadAssignmentAttachment();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [allowLate, setAllowLate] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Assignment | null>(null);
  const [viewingSubmissions, setViewingSubmissions] = useState<Assignment | null>(null);

  const resetForm = () => {
    setTitle(""); setDescription(""); setCourseId(""); setDueAt(""); setMaxScore("100");
    setAllowLate(false); setAttachments([]); setUploadProgress(null); setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      setUploadProgress(0);
      try {
        const uploaded = await uploadAttachment.mutateAsync({ file, onProgress: setUploadProgress });
        setAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        setFormError(getApiError(err));
      } finally {
        setUploadProgress(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      setFormError(t("assignments.form.required"));
      return;
    }
    if (!courseId) {
      setFormError(t("assignments.form.courseRequired"));
      return;
    }
    if (!dueAt) {
      setFormError(t("assignments.form.dueRequired"));
      return;
    }
    setFormError(null);
    try {
      await createAssignment.mutateAsync({
        CourseId: courseId,
        Title: title.trim(),
        Description: description.trim(),
        DueAt: new Date(dueAt).toISOString(),
        MaxScore: Number(maxScore) || 100,
        AllowLate: allowLate,
        Attachments: attachments,
      });
      toast({ title: t("assignments.created") });
      setOpen(false);
      resetForm();
    } catch (err) {
      setFormError(getApiError(err, t("assignments.createFailed")));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAssignment.mutateAsync(pendingDelete.Id);
      toast({ title: t("assignments.deleted") });
    } catch (err) {
      toast({ variant: "destructive", title: t("assignments.deleteFailed"), description: getApiError(err) });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("assignments.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("assignments.subtitle")}</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-white shadow-glow-accent">
                <Plus className="w-4 h-4 me-2" /> {t("assignments.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("assignments.form.title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="assignment-title">{t("assignments.form.titleLabel")}</Label>
                  <Input id="assignment-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("assignments.form.titlePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-description">{t("assignments.form.description")}</Label>
                  <Textarea id="assignment-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("assignments.form.descriptionPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-course">{t("assignments.form.course")}</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger id="assignment-course"><SelectValue placeholder={t("assignments.form.coursePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignment-due">{t("assignments.form.dueAt")}</Label>
                    <Input id="assignment-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignment-maxscore">{t("assignments.form.maxScore")}</Label>
                    <Input id="assignment-maxscore" type="number" min={1} max={100000} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="assignment-allow-late" className="cursor-pointer">{t("assignments.form.allowLate")}</Label>
                  <Switch id="assignment-allow-late" checked={allowLate} onCheckedChange={setAllowLate} />
                </div>
                <div className="space-y-2">
                  <Label>{t("assignments.form.attachments")}</Label>
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <div key={a.Url} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                        <span className="flex items-center gap-2 truncate"><Paperclip className="w-3.5 h-3.5 shrink-0" />{a.Name}</span>
                        <button type="button" aria-label={t("assignments.form.removeAttachment")} onClick={() => setAttachments((prev) => prev.filter((x) => x.Url !== a.Url))}>
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null}>
                    {uploadProgress !== null ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" />
                        {t("assignments.form.uploading", { percent: uploadProgress })}
                      </>
                    ) : (
                      <><Paperclip className="w-3.5 h-3.5 me-2" />{t("assignments.form.addAttachment")}</>
                    )}
                  </Button>
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createAssignment.isPending}>{t("assignments.form.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createAssignment.isPending}>
                  {createAssignment.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  {t("assignments.form.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("common:labels.all")}</SelectItem>
            {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-center text-destructive py-12">{getApiError(error, t("assignments.loadFailed"))}</p>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{t("assignments.empty")}</p>
        </div>
      ) : (
        <section className="space-y-3 animate-slide-up" style={{ animationDelay: "200ms" }}>
          {assignments.map((a) => (
            <Card key={a.Id} className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">{a.Title}</h3>
                      <Badge variant="outline" className="text-xs">{a.CourseTitle ?? t("common:deletedCourse")}</Badge>
                      <Badge variant="outline" className="text-xs">{t("assignments.maxScore", { score: a.MaxScore })}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {t("assignments.due", { date: formatDate(a.DueAt) })}
                      {" · "}{a.AllowLate ? t("assignments.allowLate") : t("assignments.noLate")}
                    </p>
                    {a.Attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {a.Attachments.map((att) => (
                          <button
                            key={att.Url}
                            type="button"
                            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                            disabled={downloadingUrl === att.Url}
                            onClick={() => downloadAttachment(a.Id, att)}
                          >
                            {downloadingUrl === att.Url ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                            {att.Name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                      <Users className="w-3.5 h-3.5" />
                      <bdi>{t("assignments.submissionsCount", { submitted: a.SubmissionCount ?? 0, enrolled: a.EnrolledCount ?? 0 })}</bdi>
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setViewingSubmissions(a)}>
                      <CheckCircle className="w-3.5 h-3.5 me-1.5" /> {t("assignments.viewSubmissions")}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" aria-label={t("assignments.delete")} onClick={() => setPendingDelete(a)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Sheet open={!!viewingSubmissions} onOpenChange={(o) => !o && setViewingSubmissions(null)}>
        <SheetContent side="end" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewingSubmissions?.Title}</SheetTitle>
          </SheetHeader>
          {viewingSubmissions && <SubmissionsPanel assignment={viewingSubmissions} />}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assignments.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && t("assignments.confirmDeleteDesc", { title: pendingDelete.Title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assignments.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("assignments.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InstructorPageLayout>
  );
};

export default InstructorAssignments;
