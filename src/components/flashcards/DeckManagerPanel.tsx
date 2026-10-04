import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Upload, Download, FileJson, FileSpreadsheet,
  AlertCircle, Globe, Lock, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import {
  useDeckCardsQuery, useAddDeckCard, useUpdateDeckCard, useDeleteDeckCard,
  useImportDeckCards, useExportDeckCards, useUpdateDeck, useAddToMyCards,
  type Deck, type DeckCard,
} from "@/hooks/useDecks";

interface DeckManagerPanelProps {
  deck: Deck;
}

export function DeckManagerPanel({ deck }: DeckManagerPanelProps) {
  const { t } = useTranslation("learning");
  const { user, role } = useAuth();
  const { can } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = deck.OwnerId === user?.Id || (deck.Kind === "Instructor" && role === "admin");
  const canAddToMyCards = can(PERMISSIONS.flashcardsUse);

  const cardsQuery = useDeckCardsQuery(deck.Id);
  const cards = cardsQuery.data ?? [];

  const addCard = useAddDeckCard(deck.Id);
  const updateCard = useUpdateDeckCard(deck.Id);
  const deleteCard = useDeleteDeckCard(deck.Id);
  const importCards = useImportDeckCards(deck.Id);
  const exportCards = useExportDeckCards(deck.Id);
  const updateDeck = useUpdateDeck();
  const addToMyCards = useAddToMyCards();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeckCard | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckCard | null>(null);

  const openCreate = () => {
    setEditing(null);
    setQuestion("");
    setAnswer("");
    setHint("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (card: DeckCard) => {
    setEditing(card);
    setQuestion(card.Question);
    setAnswer(card.Answer);
    setHint(card.Hint ?? "");
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveCard = async () => {
    if (!question.trim() || !answer.trim()) {
      setFormError(t("flashcards.cards.required"));
      return;
    }
    setFormError(null);
    try {
      const body = { Question: question.trim(), Answer: answer.trim(), Hint: hint.trim() || null };
      if (editing) await updateCard.mutateAsync({ cardId: editing.Id, ...body });
      else await addCard.mutateAsync(body);
      toast.success(editing ? t("flashcards.cards.saved") : t("flashcards.cards.created"));
      setFormOpen(false);
    } catch (err) {
      setFormError(getApiError(err, t("flashcards.cards.saveFailed")));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCard.mutateAsync(pendingDelete.Id);
      toast.success(t("flashcards.cards.deleted"));
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.cards.deleteFailed")));
    } finally {
      setPendingDelete(null);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await importCards.mutateAsync(file);
      toast.success(t("flashcards.import.result", { imported: result.Imported, skipped: result.Skipped, total: result.Total }));
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.import.failed")));
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      await exportCards.mutateAsync(format);
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.export.failed")));
    }
  };

  const handleTogglePublish = async (published: boolean) => {
    try {
      await updateDeck.mutateAsync({ id: deck.Id, visibility: published ? "Published" : "Private" });
      toast.success(published ? t("flashcards.publish.published") : t("flashcards.publish.unpublished"));
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.publish.failed")));
    }
  };

  const handleAddToMyCards = async () => {
    try {
      const result = await addToMyCards.mutateAsync(deck.Id);
      toast.success(t("flashcards.toast.addedCards", { added: result.Added, alreadyOwned: result.AlreadyOwned }));
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.toast.addFailed")));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("csv")} disabled={exportCards.isPending}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> {t("flashcards.export.csv")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("json")} disabled={exportCards.isPending}>
            <FileJson className="w-3.5 h-3.5" /> {t("flashcards.export.json")}
          </Button>
          {canManage && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImportFile} />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleImportClick} disabled={importCards.isPending}>
                {importCards.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {t("flashcards.import.button")}
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canAddToMyCards && (
            <Button size="sm" className="gap-1.5" onClick={handleAddToMyCards} disabled={addToMyCards.isPending}>
              {addToMyCards.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t("flashcards.addToMyCards")}
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> {t("flashcards.cards.add")}
            </Button>
          )}
        </div>
      </div>

      {canManage && deck.Kind === "Instructor" && (
        <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            {deck.Visibility === "Published" ? <Globe className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
            <span>{deck.Visibility === "Published" ? t("flashcards.publish.publishedHint") : t("flashcards.publish.privateHint")}</span>
          </div>
          <Switch checked={deck.Visibility === "Published"} onCheckedChange={handleTogglePublish} disabled={updateDeck.isPending} />
        </div>
      )}

      {cardsQuery.isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{getApiError(cardsQuery.error, t("flashcards.cards.loadFailed"))}</span>
        </div>
      ) : cardsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : cards.length === 0 ? (
        <div className="text-center py-8">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t("flashcards.cards.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pe-1">
          {cards.map((card) => (
            <div key={card.Id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{card.Question}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{card.Answer}</p>
                {card.Hint && (
                  <Badge variant="outline" className="mt-1.5 text-[10px]">{t("flashcards.cards.hintLabel", { hint: card.Hint })}</Badge>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("flashcards.cards.edit")} onClick={() => openEdit(card)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("flashcards.cards.delete")} onClick={() => setPendingDelete(card)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("flashcards.cards.editTitle") : t("flashcards.cards.addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="card-question">{t("flashcards.cards.question")}</Label>
              <Textarea id="card-question" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder={t("flashcards.cards.questionPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-answer">{t("flashcards.cards.answer")}</Label>
              <Textarea id="card-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder={t("flashcards.cards.answerPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-hint">{t("flashcards.cards.hint")}</Label>
              <Input id="card-hint" value={hint} onChange={(e) => setHint(e.target.value)} placeholder={t("flashcards.cards.hintPlaceholder")} />
            </div>
            {formError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button onClick={handleSaveCard} disabled={addCard.isPending || updateCard.isPending}>
              {(addCard.isPending || updateCard.isPending) && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("flashcards.cards.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("flashcards.cards.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DeckManagerPanel;
