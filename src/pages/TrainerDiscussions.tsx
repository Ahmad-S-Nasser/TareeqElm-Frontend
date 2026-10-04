import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
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
import { useEnrollmentsQuery } from "@/hooks/useTrainerApi";
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
  const { t } = useTranslation(["learning", "common"]);
  const { formatDateTime } = useFormatters();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useDiscussionQuery(thread.Id);
  const setState = useSetDiscussionState();
  const deleteDiscussion = useDeleteDiscussion();
  const reply = useReplyToDiscussion();
  const deleteReply = useDeleteDiscussionReply();
  const [replyBody, setReplyBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingReplyDelete, setPendingReplyDelete] = useState<string | null>(null);

  const current = data?.Thread ?? thread;

  const togglePinned = async () => {
    try {
      await setState.mutateAsync({ id: thread.Id, body: { Pinned: !current.Pinned } });
    } catch (err) {
      toast({ variant: "destructive", title: t("discussions.stateFailed"), description: getApiError(err) });
    }
  };

  const toggleLocked = async () => {
    try {
      await setState.mutateAsync({ id: thread.Id, body: { Locked: !current.Locked } });
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

  return (
    <div className="space-y-4 mt-4">
      <Can permission={PERMISSIONS.discussionsManage}>
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
      </Can>

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
          {data?.Replies.map((r) => {
            const canDelete = r.AuthorId === user?.Id;
            return (
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
                {canDelete && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" aria-label={t("discussions.thread.deleteReply")} onClick={() => setPendingReplyDelete(r.Id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        {current.Locked ? (
          <p className="text-sm text-muted-foreground">{t("discussions.thread.lockedNotice")}</p>
        ) : (
          <Can permission={[PERMISSIONS.discussionsManage, PERMISSIONS.discussionsParticipate]}>
            <Textarea rows={2} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={t("discussions.thread.replyPlaceholder")} />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleReply} disabled={reply.isPending || !replyBody.trim()}>
                {reply.isPending ? <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" /> : <Send className="w-3.5 h-3.5 me-2" />}
                {t("discussions.thread.send")}
              </Button>
            </div>
          </Can>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discussions.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("discussions.confirmDeleteDesc", { title: current.Title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
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
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReply} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("discussions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TrainerDiscussions = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["learning", "common"]);
  const { formatRelativeTime } = useFormatters();
  const { toast } = useToast();
  const { data: enrollments = [] } = useEnrollmentsQuery();
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
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <MessageSquare className="w-7 h-7 text-primary" /> {t("discussions.title")}
              </h1>
              <p className="text-muted-foreground mt-1">{t("discussions.subtitle")}</p>
            </div>
            <Can permission={PERMISSIONS.discussionsManage}>
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 me-2" /> {t("discussions.new")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("discussions.form.title")}</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="td-title">{t("discussions.form.titleLabel")}</Label>
                      <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("discussions.form.titlePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="td-body">{t("discussions.form.body")}</Label>
                      <Textarea id="td-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("discussions.form.bodyPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="td-course">{t("discussions.form.course")}</Label>
                      <Select value={courseId} onValueChange={setCourseId}>
                        <SelectTrigger id="td-course"><SelectValue placeholder={t("discussions.form.coursePlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          {enrollments.map((e) => <SelectItem key={e.CourseId} value={e.CourseId}>{e.CourseTitle ?? e.Course.Title}</SelectItem>)}
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
            </Can>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="text-center py-16 text-destructive">{getApiError(error, t("discussions.loadFailed"))}</div>
          ) : discussions.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">{t("discussions.empty")}</p>
              <p className="text-sm text-muted-foreground">{t("discussions.emptyHint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discussions.map((d) => (
                <Card key={d.Id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(d)}>
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
            </div>
          )}
        </div>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="end" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.Title}</SheetTitle>
          </SheetHeader>
          {selected && <ThreadDetail thread={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TrainerDiscussions;
