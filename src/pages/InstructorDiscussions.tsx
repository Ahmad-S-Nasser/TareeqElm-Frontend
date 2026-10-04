import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { MessageSquare, Pin, Lock, Unlock, Clock, Plus, Loader2, AlertCircle, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  useDiscussionsQuery,
  useDiscussionQuery,
  useCreateDiscussion,
  useSetDiscussionState,
  useDeleteDiscussion,
  useReplyToDiscussion,
  useDeleteDiscussionReply,
  type DiscussionThread,
} from "@/hooks/useDiscussions";

const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("");

const ThreadDetail = ({ thread, onClose }: { thread: DiscussionThread; onClose: () => void }) => {
  const { t } = useTranslation(["instructor", "common"]);
  const { formatDateTime } = useFormatters();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useDiscussionQuery(thread.Id);
  const setState = useSetDiscussionState();
  const deleteDiscussion = useDeleteDiscussion();
  const reply = useReplyToDiscussion();
  const deleteReply = useDeleteDiscussionReply();
  const [replyBody, setReplyBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingReplyDelete, setPendingReplyDelete] = useState<string | null>(null);

  const togglePinned = async () => {
    try {
      await setState.mutateAsync({ id: thread.Id, body: { Pinned: !thread.Pinned } });
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.stateFailed"), description: getApiError(err) });
    }
  };

  const toggleLocked = async () => {
    try {
      await setState.mutateAsync({ id: thread.Id, body: { Locked: !thread.Locked } });
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.stateFailed"), description: getApiError(err) });
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    try {
      await reply.mutateAsync({ id: thread.Id, body: { Body: replyBody.trim() } });
      setReplyBody("");
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.thread.replyFailed"), description: getApiError(err) });
    }
  };

  const handleDeleteThread = async () => {
    try {
      await deleteDiscussion.mutateAsync(thread.Id);
      toast({ title: t("discussions.deleted") });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.deleteFailed"), description: getApiError(err) });
    }
  };

  const handleDeleteReply = async () => {
    if (!pendingReplyDelete) return;
    try {
      await deleteReply.mutateAsync({ id: thread.Id, replyId: pendingReplyDelete });
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.thread.deleteReplyFailed"), description: getApiError(err) });
    } finally {
      setPendingReplyDelete(null);
    }
  };

  const current = data?.Thread ?? thread;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={togglePinned} disabled={setState.isPending}>
          <Pin className="w-3.5 h-3.5 me-1.5" /> {current.Pinned ? t("discussions.unpin") : t("discussions.pin")}
        </Button>
        <Button size="sm" variant="outline" onClick={toggleLocked} disabled={setState.isPending}>
          {current.Locked ? <Unlock className="w-3.5 h-3.5 me-1.5" /> : <Lock className="w-3.5 h-3.5 me-1.5" />}
          {current.Locked ? t("discussions.unlock") : t("discussions.lock")}
        </Button>
        <Button size="sm" variant="outline" className="text-destructive ms-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="w-3.5 h-3.5 me-1.5" /> {t("discussions.delete")}
        </Button>
      </div>

      <p className="text-sm whitespace-pre-wrap">{current.Body}</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-center text-destructive py-8">{getApiError(error, t("discussions.thread.loadFailed"))}</p>
      ) : (
        <div className="space-y-3 border-t pt-4">
          {data && data.Replies.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("discussions.thread.noReplies")}</p>
          )}
          {/* Every thread on this page belongs to a course the caller teaches (or the caller is Admin/Organization),
              so the backend's "reply author or the course's instructor" rule always allows deleting any reply here. */}
          {data?.Replies.map((r) => (
            <div key={r.Id} className="flex items-start gap-2">
              <Avatar className="w-7 h-7 mt-0.5">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(r.AuthorName ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.AuthorName ?? t("common:deletedUser")}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.CreatedAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.Body}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" aria-label={t("discussions.thread.deleteReply")} onClick={() => setPendingReplyDelete(r.Id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        {current.Locked ? (
          <p className="text-sm text-muted-foreground">{t("discussions.thread.lockedNotice")}</p>
        ) : (
          <>
            <Textarea rows={2} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={t("discussions.thread.replyPlaceholder")} />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleReply} disabled={reply.isPending || !replyBody.trim()}>
                {reply.isPending ? <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" /> : <Send className="w-3.5 h-3.5 me-2" />}
                {t("discussions.thread.send")}
              </Button>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discussions.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("discussions.confirmDeleteDesc", { title: current.Title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discussions.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteThread} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("discussions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingReplyDelete} onOpenChange={(o) => !o && setPendingReplyDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discussions.thread.deleteReply")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discussions.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReply} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("discussions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const InstructorDiscussions = () => {
  const { t } = useTranslation(["instructor", "common"]);
  const { formatRelativeTime } = useFormatters();
  const { toast } = useToast();
  const { data: courses = [] } = useMyCoursesQuery();
  const { data: discussions = [], isLoading, isError, error } = useDiscussionsQuery();
  const createDiscussion = useCreateDiscussion();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DiscussionThread | null>(null);

  const resetForm = () => { setTitle(""); setBody(""); setCourseId(""); setFormError(null); };

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) {
      setFormError(t("discussions.form.required"));
      return;
    }
    if (!courseId) {
      setFormError(t("discussions.form.courseRequired"));
      return;
    }
    setFormError(null);
    try {
      await createDiscussion.mutateAsync({ CourseId: courseId, Title: title.trim(), Body: body.trim() });
      toast({ title: t("discussions.created") });
      setOpen(false);
      resetForm();
    } catch (err) {
      setFormError(getApiError(err, t("discussions.createFailed")));
    }
  };

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("discussions.title")}</h1>
            </div>
            <p className="text-muted-foreground text-sm">{t("discussions.subtitle")}</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-white shadow-glow-accent">
                <Plus className="w-4 h-4 me-2" /> {t("discussions.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("discussions.form.title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="discussion-title">{t("discussions.form.titleLabel")}</Label>
                  <Input id="discussion-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("discussions.form.titlePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discussion-body">{t("discussions.form.body")}</Label>
                  <Textarea id="discussion-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("discussions.form.bodyPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discussion-course">{t("discussions.form.course")}</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger id="discussion-course"><SelectValue placeholder={t("discussions.form.coursePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createDiscussion.isPending}>{t("discussions.form.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createDiscussion.isPending}>
                  {createDiscussion.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  {t("discussions.form.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-center text-destructive py-12">{getApiError(error, t("discussions.loadFailed"))}</p>
      ) : discussions.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{t("discussions.empty")}</p>
        </div>
      ) : (
        <section className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
          {discussions.map((d) => (
            <Card
              key={d.Id}
              className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow cursor-pointer"
              onClick={() => setSelected(d)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-9 h-9 mt-0.5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(d.AuthorName ?? "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {d.Pinned && <Pin className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                      {d.Locked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                      <h3 className="font-medium text-sm truncate">{d.Title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{d.AuthorName ?? t("common:deletedUser")}</span>
                      <Badge variant="outline" className="text-[10px]">{d.CourseTitle ?? t("common:deletedCourse")}</Badge>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t("discussions.repliesCount", { count: d.ReplyCount })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(d.CreatedAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="end" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.Title}</SheetTitle>
          </SheetHeader>
          {selected && <ThreadDetail thread={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </InstructorPageLayout>
  );
};

export default InstructorDiscussions;
