import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { DeckCard, DeckManagerPanel, MasteryBadge, FlashcardStudySession } from "@/components/flashcards";
import { useDecksQuery, useCreatePersonalDeck, useAddToMyCards } from "@/hooks/useDecks";
import { useFlashcardsQuery } from "@/hooks/useFlashcards";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Layers, Brain, TrendingUp, Clock, Plus, Trophy, AlertCircle, Loader2, Zap,
} from "lucide-react";

const Flashcards = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["learning", "common"]);
  const { formatNumber } = useFormatters();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canAddToMyCards = can(PERMISSIONS.flashcardsUse);

  const decksQuery = useDecksQuery();
  const decks = useMemo(() => decksQuery.data ?? [], [decksQuery.data]);
  const cardsQuery = useFlashcardsQuery();
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const dueCards = useMemo(() => cards.filter((c) => c.nextReview <= new Date()), [cards]);

  const createDeck = useCreatePersonalDeck();
  const addToMyCards = useAddToMyCards();

  const [isStudying, setIsStudying] = useState(false);

  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const openDeck = openDeckId ? decks.find((d) => d.Id === openDeckId) ?? null : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const stats = {
    totalCards: cards.length,
    masteredCards: cards.filter((c) => c.isMastered).length,
    dueCards: dueCards.length,
    decksActive: decks.length,
  };

  const handleCreateDeck = async () => {
    if (!newTitle.trim()) {
      setFormError(t("flashcards.deckNameRequired"));
      return;
    }
    setFormError(null);
    try {
      await createDeck.mutateAsync({ title: newTitle, description: newDescription });
      toast.success(t("flashcards.toast.deckCreated"));
      setIsCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
    } catch (err) {
      setFormError(getApiError(err, t("flashcards.toast.deckCreateFailed")));
    }
  };

  const handleAddToMyCards = async (deckId: string) => {
    try {
      const result = await addToMyCards.mutateAsync(deckId);
      toast.success(t("flashcards.toast.addedCards", { added: result.Added, alreadyOwned: result.AlreadyOwned }));
    } catch (err) {
      toast.error(getApiError(err, t("flashcards.toast.addFailed")));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        {isStudying ? (
          <div className="max-w-7xl mx-auto">
            <FlashcardStudySession cards={dueCards} onExit={() => setIsStudying(false)} />
          </div>
        ) : (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <section className="animate-slide-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold">{t("flashcards.title")}</h1>
                </div>
                <p className="text-muted-foreground">{t("flashcards.subtitle")}</p>
              </div>
              <Can permission={PERMISSIONS.flashcardsUse}>
                <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {t("flashcards.createDeck")}
                </Button>
              </Can>
            </div>
          </section>

          {/* Stats Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalCards)}</p>
                  <p className="text-xs text-muted-foreground">{t("flashcards.totalCards")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.masteredCards)}</p>
                  <p className="text-xs text-muted-foreground">{t("flashcards.masteredLabel")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.dueCards)}</p>
                  <p className="text-xs text-muted-foreground">{t("flashcards.dueToday")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.decksActive)}</p>
                  <p className="text-xs text-muted-foreground">{t("flashcards.decksActive")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Due Today Banner */}
          {stats.dueCards > 0 && (
            <section className="animate-slide-up" style={{ animationDelay: "150ms" }}>
              <div className="rounded-2xl bg-gradient-to-r from-warning/10 to-orange-500/10 border border-warning/20 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">{t("flashcards.dueForReview")}</h2>
                    <p className="text-sm text-muted-foreground">{t("flashcards.dueSummary", { cards: stats.dueCards })}</p>
                  </div>
                  <Button className="gap-2" onClick={() => setIsStudying(true)}>
                    <Zap className="w-4 h-4" />
                    {t("flashcards.startReview")}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Deck Grid */}
          <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <h2 className="text-lg font-semibold mb-4">{t("flashcards.yourDecks")}</h2>
            {decksQuery.isError ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="flex-1">{getApiError(decksQuery.error, t("flashcards.loadFailed"))}</span>
                <Button size="sm" variant="outline" onClick={() => decksQuery.refetch()}>{t("common:actions.retry")}</Button>
              </div>
            ) : decksQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : decks.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">{t("flashcards.empty")}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {decks.map((deck) => (
                  <DeckCard
                    key={deck.Id}
                    deck={deck}
                    isOwner={deck.OwnerId === user?.Id}
                    onOpen={() => setOpenDeckId(deck.Id)}
                    onAddToMyCards={canAddToMyCards ? () => handleAddToMyCards(deck.Id) : undefined}
                    addingToMyCards={addToMyCards.isPending && addToMyCards.variables === deck.Id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* My Study Cards */}
          <section className="animate-slide-up" style={{ animationDelay: "250ms" }}>
            <h2 className="text-lg font-semibold mb-4">{t("flashcards.myStudySet.title")}</h2>
            {cardsQuery.isError ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="flex-1">{getApiError(cardsQuery.error, t("flashcards.loadFailed"))}</span>
              </div>
            ) : cardsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : cards.length === 0 ? (
              <div className="text-center py-8 rounded-2xl bg-card border border-border/50">
                <p className="text-muted-foreground">{t("flashcards.myStudySet.empty")}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border/50 shadow-soft divide-y divide-border/50">
                {cards.slice(0, 20).map((card) => (
                  <div key={card.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{card.question}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.topic ?? t("spaced.generalTopic")}</p>
                    </div>
                    <MasteryBadge isMastered={card.isMastered} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        )}
      </main>

      {/* Create Deck Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setFormError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("flashcards.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deck-title">{t("flashcards.deckName")}</Label>
              <Input id="deck-title" placeholder={t("flashcards.deckNamePlaceholder")} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-description">{t("flashcards.topic")}</Label>
              <Textarea id="deck-description" placeholder={t("flashcards.topicPlaceholder")} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
            </div>
            {formError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button onClick={handleCreateDeck} disabled={createDeck.isPending}>
              {createDeck.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t("flashcards.createDeck")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deck Manager Dialog */}
      <Dialog open={!!openDeckId} onOpenChange={(o) => !o && setOpenDeckId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {openDeck && (
            <>
              <DialogHeader>
                <DialogTitle>{openDeck.Title}</DialogTitle>
              </DialogHeader>
              <DeckManagerPanel deck={openDeck} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Flashcards;
