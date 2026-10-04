import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Megaphone, Plus, Clock, BookOpen, Pin, Trash2, Loader2, AlertCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import {
  useAnnouncementsQuery,
  useCreateAnnouncement,
  useSetAnnouncementPinned,
  useDeleteAnnouncement,
  type Announcement,
} from "@/hooks/useAnnouncements";

// Instructors may only post to a course they teach, so the audience is always "course".
const INSTRUCTOR_AUDIENCE = "course" as const;

const cnPinned = (pinned: boolean) => (pinned ? "w-4 h-4 fill-primary text-primary" : "w-4 h-4");

const InstructorAnnouncements = () => {
  const { t } = useTranslation("instructor");
  const { formatDate } = useFormatters();
  const { toast } = useToast();
  const { data: courses = [] } = useMyCoursesQuery();
  const { data: announcements = [], isLoading, isError, error } = useAnnouncementsQuery();
  const createAnnouncement = useCreateAnnouncement();
  const setPinned = useSetAnnouncementPinned();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setCourseId("");
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) {
      setFormError(t("announcements.form.required"));
      return;
    }
    if (!courseId) {
      setFormError(t("announcements.form.courseRequired"));
      return;
    }
    setFormError(null);
    try {
      await createAnnouncement.mutateAsync({
        Title: title.trim(),
        Body: body.trim(),
        Audience: INSTRUCTOR_AUDIENCE,
        CourseId: courseId,
      });
      toast({ title: t("announcements.posted") });
      setOpen(false);
      resetForm();
    } catch (err) {
      setFormError(getApiError(err, t("announcements.postFailed")));
    }
  };

  const handleTogglePin = async (item: Announcement) => {
    try {
      await setPinned.mutateAsync({ id: item.Id, pinned: !item.Pinned });
    } catch (err) {
      toast({ variant: "destructive", title: t("announcements.pinFailed"), description: getApiError(err) });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAnnouncement.mutateAsync(pendingDelete.Id);
      toast({ title: t("announcements.deleted") });
    } catch (err) {
      toast({ variant: "destructive", title: t("announcements.deleteFailed"), description: getApiError(err) });
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
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("announcements.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("announcements.subtitle")}</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-white shadow-glow-accent">
                <Plus className="w-4 h-4 me-2" /> {t("announcements.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("announcements.form.title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">{t("announcements.form.titleLabel")}</Label>
                  <Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("announcements.form.titlePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-body">{t("announcements.form.body")}</Label>
                  <Textarea id="announcement-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("announcements.form.bodyPlaceholder")} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-course">{t("announcements.form.course")}</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger id="announcement-course"><SelectValue placeholder={t("announcements.form.coursePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("announcements.form.instructorScopeHint")}</p>
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createAnnouncement.isPending}>{t("announcements.form.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createAnnouncement.isPending}>
                  {createAnnouncement.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  {t("announcements.form.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-center text-destructive py-12">{getApiError(error, t("announcements.loadFailed"))}</p>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12">
          <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{t("announcements.empty")}</p>
        </div>
      ) : (
        <section className="space-y-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
          {announcements.map((a) => (
            <Card key={a.Id} className={a.Pinned ? "shadow-soft border-primary/30 bg-primary/[0.02]" : "shadow-soft border-border/50"}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2">
                    {a.Pinned && <Pin className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <h3 className="font-semibold">{a.Title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={a.Pinned ? t("announcements.unpin") : t("announcements.pin")} onClick={() => handleTogglePin(a)} disabled={setPinned.isPending}>
                      <Pin className={cnPinned(a.Pinned)} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("announcements.delete")} onClick={() => setPendingDelete(a)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="w-3 h-3 me-1" /> {a.CourseTitle ?? t(`announcements.audiences.${a.Audience}`)}
                  </Badge>
                  {a.AuthorName && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {a.AuthorName}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(a.CreatedAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.Body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("announcements.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && t("announcements.confirmDeleteDesc", { title: pendingDelete.Title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("announcements.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("announcements.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InstructorPageLayout>
  );
};

export default InstructorAnnouncements;
