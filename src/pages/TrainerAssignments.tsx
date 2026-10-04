import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Clock, Loader2, AlertCircle, Paperclip, Download, X, FileText, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  useAssignmentsQuery,
  useSubmitAssignment,
  useUploadSubmissionFile,
  useDownloadAssignmentAttachment,
  type Assignment,
  type Attachment,
} from "@/hooks/useAssignments";

const ALL = "all";

const statusBadgeClass: Record<string, string> = {
  notSubmitted: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  late: "bg-warning/10 text-warning",
  graded: "bg-success/10 text-success",
};

const statusOf = (a: Assignment) => a.MySubmission?.Status ?? "notSubmitted";

const AssignmentDetail = ({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) => {
  const { t } = useTranslation(["learning", "common"]);
  const { formatDate, formatDateTime } = useFormatters();
  const { toast } = useToast();
  const { download, downloadingUrl } = useDownloadAssignmentAttachment();
  const submitAssignment = useSubmitAssignment();
  const uploadFile = useUploadSubmissionFile();

  const submission = assignment.MySubmission;
  const graded = submission?.Status === "graded";
  const past = new Date(assignment.DueAt).getTime() < Date.now();
  const closed = past && !assignment.AllowLate && !submission;

  const [text, setText] = useState(submission?.Text ?? "");
  const [files, setFiles] = useState<Attachment[]>(submission?.Files ?? []);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    for (const file of Array.from(selected)) {
      setUploadProgress(0);
      try {
        const uploaded = await uploadFile.mutateAsync({ assignmentId: assignment.Id, file, onProgress: setUploadProgress });
        setFiles((prev) => [...prev, uploaded]);
      } catch (err) {
        setError(getApiError(err));
      } finally {
        setUploadProgress(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) {
      setError(t("assignments.detail.required"));
      return;
    }
    setError(null);
    try {
      await submitAssignment.mutateAsync({ assignmentId: assignment.Id, body: { Text: text.trim() || undefined, Files: files } });
      toast({ title: t("assignments.detail.submitted") });
    } catch (err) {
      setError(getApiError(err, t("assignments.detail.submitFailed")));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm whitespace-pre-wrap">{assignment.Description}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <Clock className="w-3.5 h-3.5" /> {t("assignments.due", { date: formatDate(assignment.DueAt) })}
        <span>·</span>
        <span>{t("assignments.maxScore", { score: assignment.MaxScore })}</span>
      </div>

      {assignment.Attachments.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">{t("assignments.detail.attachments")}</Label>
          {assignment.Attachments.map((a) => (
            <button
              key={a.Url}
              type="button"
              className="flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
              disabled={downloadingUrl === a.Url}
              onClick={() => download(assignment.Id, a)}
            >
              {downloadingUrl === a.Url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {a.Name}
            </button>
          ))}
        </div>
      )}

      {graded && submission && (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" />{t("assignments.detail.grade")}: <bdi>{submission.Score}/{assignment.MaxScore}</bdi></p>
            <p className="text-sm text-muted-foreground">{submission.Feedback || t("assignments.detail.noFeedback")}</p>
          </CardContent>
        </Card>
      )}

      <Can permission={PERMISSIONS.assignmentsSubmit}>
        <div className="space-y-3 border-t pt-4">
          <Label className="text-sm font-medium">{graded ? t("assignments.detail.yourSubmission") : t("assignments.detail.submitTitle")}</Label>
          {closed ? (
            <p className="text-sm text-muted-foreground">{t("assignments.detail.closedNotice")}</p>
          ) : graded ? (
            <p className="text-sm text-muted-foreground">{t("assignments.detail.gradedNotice")}</p>
          ) : (
            <>
              <Textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("assignments.detail.textPlaceholder")}
              />
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.Url} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2 truncate"><Paperclip className="w-3.5 h-3.5 shrink-0" />{f.Name}</span>
                    <button type="button" aria-label={t("assignments.detail.removeFile")} onClick={() => setFiles((prev) => prev.filter((x) => x.Url !== f.Url))}>
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null}>
                {uploadProgress !== null ? (
                  <><Loader2 className="w-3.5 h-3.5 me-2 animate-spin" />{t("assignments.detail.uploading", { percent: uploadProgress })}</>
                ) : (
                  <><Paperclip className="w-3.5 h-3.5 me-2" />{t("assignments.detail.addFile")}</>
                )}
              </Button>
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {submission && (
                <p className="text-xs text-muted-foreground">{t("assignments.detail.submittedOn", { date: formatDateTime(submission.SubmittedAt) })}</p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitAssignment.isPending}>
                  {submitAssignment.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  {submission ? t("assignments.detail.resubmit") : t("assignments.detail.submit")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Can>
    </div>
  );
};

const TrainerAssignments = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["learning", "common"]);
  const { formatDate } = useFormatters();
  const { data: assignments = [], isLoading, isError, error } = useAssignmentsQuery();
  const [courseFilter, setCourseFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Assignment | null>(null);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    assignments.forEach((a) => map.set(a.CourseId, a.CourseTitle ?? t("common:deletedCourse")));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [assignments, t]);

  const visible = courseFilter === ALL ? assignments : assignments.filter((a) => a.CourseId === courseFilter);

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-primary" /> {t("assignments.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("assignments.subtitle")}</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="text-center py-16 text-destructive">{getApiError(error, t("assignments.loadFailed"))}</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">{t("assignments.empty")}</p>
              <p className="text-sm text-muted-foreground">{t("assignments.emptyHint")}</p>
            </div>
          ) : (
            <>
              {courses.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={courseFilter === ALL ? "default" : "outline"} onClick={() => setCourseFilter(ALL)}>
                    {t("assignments.allCourses")}
                  </Button>
                  {courses.map((c) => (
                    <Button key={c.id} size="sm" variant={courseFilter === c.id ? "default" : "outline"} onClick={() => setCourseFilter(c.id)}>
                      {c.title}
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {visible.map((a) => (
                  <Card key={a.Id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(a)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{a.Title}</CardTitle>
                        <Badge className={statusBadgeClass[statusOf(a)]}>{t(`assignments.status.${statusOf(a)}`)}</Badge>
                      </div>
                      <CardDescription>{a.CourseTitle ?? t("common:deletedCourse")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t("assignments.due", { date: formatDate(a.DueAt) })}</p>
                      {a.MySubmission?.Status === "graded" && (
                        <p className="text-sm font-medium"><bdi>{a.MySubmission.Score}/{a.MaxScore}</bdi></p>
                      )}
                      {a.Attachments.length > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />{a.Attachments.length}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="end" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.Title}</SheetTitle>
          </SheetHeader>
          {selected && <AssignmentDetail assignment={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TrainerAssignments;
