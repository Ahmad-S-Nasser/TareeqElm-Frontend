import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Layers, Plus, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { DeckCard, DeckManagerPanel } from "@/components/flashcards";
import { useDecksQuery, useCreateInstructorDeck, type DeckVisibility } from "@/hooks/useDecks";

const InstructorFlashcards = () => {
  const { t } = useTranslation("instructor");
  const { user } = useAuth();
  const { data: courses = [] } = useMyCoursesQuery();

  const decksQuery = useDecksQuery({ kind: "Instructor" });
  const decks = useMemo(() => (decksQuery.data ?? []).filter((d) => d.OwnerId === user?.Id), [decksQuery.data, user?.Id]);

  const createDeck = useCreateInstructorDeck();

  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const openDeck = openDeckId ? decks.find((d) => d.Id === openDeckId) ?? null : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [visibility, setVisibility] = useState<DeckVisibility>("Published");
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCourseId("");
    setVisibility("Published");
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setFormError(t("flashcards.form.titleRequired"));
      return;
    }
    if (!courseId) {
      setFormError(t("flashcards.form.courseRequired"));
      return;
    }
    setFormError(null);
    try {
      await createDeck.mutateAsync({ title, description, courseId, visibility });
      toast.success(t("flashcards.toast.created"));
      setIsCreateOpen(false);
      resetForm();
    } catch (err) {
      setFormError(getApiError(err, t("flashcards.toast.createFailed")));
    }
  };

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("flashcards.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("flashcards.subtitle")}</p>
          </div>
          <Can permission={PERMISSIONS.decksManage}>
          <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-white shadow-glow-accent">
                <Plus className="w-4 h-4 me-2" /> {t("flashcards.createDeck")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("flashcards.form.createTitle")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="deck-title">{t("flashcards.form.title")}</Label>
                  <Input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("flashcards.form.titlePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deck-description">{t("flashcards.form.description")}</Label>
                  <Textarea id="deck-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("flashcards.form.descriptionPlaceholder")} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deck-course">{t("flashcards.form.course")}</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger id="deck-course"><SelectValue placeholder={t("flashcards.form.coursePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deck-visibility">{t("flashcards.form.visibility")}</Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as DeckVisibility)}>
                    <SelectTrigger id="deck-visibility"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Private">{t("flashcards.form.visibilityPrivate")}</SelectItem>
                      <SelectItem value="Published">{t("flashcards.form.visibilityPublished")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("flashcards.form.visibilityHint")}</p>
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={createDeck.isPending}>{t("flashcards.form.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createDeck.isPending}>
                  {createDeck.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  {t("flashcards.form.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </Can>
        </div>
      </section>

      {decksQuery.isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{getApiError(decksQuery.error, t("flashcards.loadFailed"))}</span>
          <Button size="sm" variant="outline" onClick={() => decksQuery.refetch()}>{t("flashcards.retry")}</Button>
        </div>
      ) : decksQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : decks.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{t("flashcards.empty")}</p>
        </div>
      ) : (
        <section className="grid sm:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
          {decks.map((deck) => (
            <DeckCard key={deck.Id} deck={deck} isOwner onOpen={() => setOpenDeckId(deck.Id)} />
          ))}
        </section>
      )}

      <Dialog open={!!openDeckId} onOpenChange={(o) => !o && setOpenDeckId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {openDeck && (
            <>
              <DialogHeader><DialogTitle>{openDeck.Title}</DialogTitle></DialogHeader>
              <DeckManagerPanel deck={openDeck} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </InstructorPageLayout>
  );
};

export default InstructorFlashcards;
