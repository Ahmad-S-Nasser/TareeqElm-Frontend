import { useState, useMemo } from "react";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Brain, RotateCcw, CheckCircle2, XCircle, Clock, Layers, TrendingUp, Zap, Plus, Loader2, Sparkles, BookOpen, Target, Lightbulb, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { ReviewModeSelector, type ReviewMode } from "@/components/spaced-repetition/ReviewModeSelector";
import { MemoryStrengthBadge } from "@/components/spaced-repetition/MemoryStrengthBadge";
import { ForgettingCurveChart } from "@/components/spaced-repetition/ForgettingCurveChart";
import {
  useFlashcardsQuery, useCreateFlashcard, useReviewFlashcard, useGenerateFlashcards, useExplainFlashcard,
  type FlashcardCard, type FlashcardRating,
} from "@/hooks/useFlashcards";

type Difficulty = FlashcardRating;

const difficultyConfig = {
  again: { icon: XCircle, color: "border-destructive/30 text-destructive hover:bg-destructive/10" },
  hard: { icon: RotateCcw, color: "border-warning/30 text-warning-foreground hover:bg-warning/10" },
  good: { icon: CheckCircle2, color: "border-success/30 text-success hover:bg-success/10" },
  easy: { icon: Zap, color: "border-primary/30 text-primary hover:bg-primary/10" },
};

const SpacedRepetition = () => {
  const { t } = useTranslation(["learning", "common"]);
  const { formatNumber, formatPercent } = useFormatters();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({ question: "", answer: "", topic: "" });
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all-due");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [generateTopic, setGenerateTopic] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  // Same query key as Flashcards.tsx: an edit, import or add-to-my-cards made there is reflected here immediately.
  const cardsQuery = useFlashcardsQuery();
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const loading = cardsQuery.isLoading;

  const dueCards = useMemo(() => cards.filter((c) => c.nextReview <= new Date()), [cards]);
  const weakCards = useMemo(() => cards.filter((c) => c.easeFactor < 2.0 || (c.repetitions < 2 && c.lastReviewed)), [cards]);

  const getReviewDeck = useMemo(() => {
    switch (reviewMode) {
      case "quick": return dueCards.slice(0, 10);
      case "exam": return dueCards;
      case "weak-only": return weakCards.length > 0 ? weakCards : dueCards.filter(c => c.repetitions < 3);
      default: return dueCards;
    }
  }, [reviewMode, dueCards, weakCards]);

  const reviewDeckSize = sessionIds.length;
  const currentCard = isReviewing ? cards.find((c) => c.id === sessionIds[currentIndex]) ?? null : null;

  const calculateNextInterval = (card: FlashcardCard, difficulty: Difficulty) => {
    let { interval, easeFactor, repetitions } = card;
    switch (difficulty) {
      case "again": interval = 1; easeFactor = Math.max(1.3, easeFactor - 0.2); repetitions = 0; break;
      case "hard": interval = Math.max(1, Math.round(interval * 1.2)); easeFactor = Math.max(1.3, easeFactor - 0.15); repetitions += 1; break;
      case "good": interval = repetitions === 0 ? 1 : repetitions === 1 ? 4 : Math.round(interval * easeFactor); repetitions += 1; break;
      case "easy": interval = repetitions === 0 ? 4 : Math.round(interval * easeFactor * 1.3); easeFactor += 0.15; repetitions += 1; break;
    }
    return { interval, easeFactor, repetitions, nextReview: new Date(Date.now() + interval * 86400000), lastReviewed: new Date() };
  };

  const getIntervalLabel = (card: FlashcardCard, difficulty: Difficulty) => {
    const result = calculateNextInterval({ ...card }, difficulty);
    return t("spaced.daysShort", { count: result.interval });
  };

  // The server owns the SM-2 schedule; the shared hook stores its response in the query cache both pages read.
  const reviewMutation = useReviewFlashcard();

  const handleRate = async (difficulty: Difficulty) => {
    if (!currentCard || reviewMutation.isPending) return;
    try {
      await reviewMutation.mutateAsync({ id: currentCard.id, rating: difficulty });
    } catch (err) {
      toast.error(getApiError(err, i18n.t("learning:spaced.toast.saveReviewFailed")));
      return;
    }
    setSessionStats((prev) => ({ ...prev, reviewed: prev.reviewed + 1, [difficulty]: prev[difficulty] + 1 }));
    setShowAnswer(false);
    setExplanation(null);
    if (currentIndex + 1 >= reviewDeckSize) {
      setIsReviewing(false);
      toast.success(t("spaced.toast.sessionComplete", { count: sessionStats.reviewed + 1 }));
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const startSession = () => {
    const deck = getReviewDeck;
    if (deck.length === 0) { toast.info(t("spaced.toast.noCards")); return; }
    setSessionIds(deck.map((c) => c.id));
    setCurrentIndex(0); setShowAnswer(false); setExplanation(null);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
    setIsReviewing(true);
  };

  const addMutation = useCreateFlashcard();

  const addCard = () => {
    if (!newCard.question || !newCard.answer) { toast.error(t("spaced.toast.fillBoth")); return; }
    addMutation.mutate(
      { question: newCard.question, answer: newCard.answer, topic: newCard.topic.trim() || null },
      {
        onSuccess: () => {
          setNewCard({ question: "", answer: "", topic: "" });
          setAddDialogOpen(false);
          toast.success(t("spaced.toast.cardAdded"));
        },
        onError: (err) => toast.error(getApiError(err, i18n.t("learning:spaced.toast.saveCardFailed"))),
      }
    );
  };

  // Explain the current card (template-based explanation from the server)
  const explainMutation = useExplainFlashcard();
  const isExplaining = explainMutation.isPending;
  const explainCard = () => {
    if (!currentCard) return;
    explainMutation.mutate(currentCard.id, {
      onSuccess: (data) => setExplanation(data.Explanation || t("spaced.noExplanation")),
      onError: (err) => toast.error(getApiError(err, i18n.t("learning:spaced.toast.explainFailed"))),
    });
  };

  // Generate cards for a topic (server saves them)
  const generateMutation = useGenerateFlashcards();
  const isGeneratingCards = generateMutation.isPending;
  const generateCards = () => {
    if (!generateTopic.trim()) { toast.error(t("spaced.toast.enterTopic")); return; }
    generateMutation.mutate(
      { topic: generateTopic.trim(), count: 8 },
      {
        onSuccess: (created) => {
          if (created.length === 0) { toast.info(t("spaced.toast.noneGenerated")); return; }
          setGenerateTopic("");
          setGenerateDialogOpen(false);
          toast.success(t("spaced.toast.generated", { count: created.length }));
        },
        onError: (err) => toast.error(getApiError(err, i18n.t("learning:spaced.toast.generateFailed"))),
      }
    );
  };

  // Mastery is the server-computed IsMastered flag; never recomputed client-side.
  const masteredCards = cards.filter((c) => c.isMastered);
  const learningCards = cards.filter((c) => c.repetitions > 0 && !c.isMastered);
  const newCards = cards.filter((c) => c.repetitions === 0);
  const retentionRate = cards.length > 0 ? Math.round((masteredCards.length / cards.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />} />

      <main className={cn("pt-20 pb-10 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        <div className="max-w-5xl mx-auto space-y-6">
          {cardsQuery.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="flex-1">{getApiError(cardsQuery.error, t("spaced.loadFailed"))}</span>
              <Button size="sm" variant="outline" onClick={() => cardsQuery.refetch()}>{t("common:actions.retry")}</Button>
            </div>
          )}
          {/* Hero Header */}
          <div className="rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-background border border-accent/10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-accent/15">
                    <Brain className="w-6 h-6 text-accent" />
                  </div>
                  {t("spaced.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-2 max-w-md">{t("spaced.subtitle")}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-accent/30 text-accent hover:bg-accent/10">
                      <Wand2 className="w-4 h-4" /> {t("spaced.aiGenerate")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> {t("spaced.generatorTitle")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">{t("spaced.generatorDesc")}</p>
                      <Input placeholder={t("spaced.generatorPlaceholder")} value={generateTopic} onChange={(e) => setGenerateTopic(e.target.value)} />
                      <Button onClick={generateCards} className="w-full gap-2" disabled={isGeneratingCards}>
                        {isGeneratingCards ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {isGeneratingCards ? t("spaced.generating") : t("spaced.generate")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" /> {t("spaced.addCard")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("spaced.addTitle")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <Input placeholder={t("spaced.topicPlaceholder")} value={newCard.topic} onChange={(e) => setNewCard({ ...newCard, topic: e.target.value })} />
                      <Textarea placeholder={t("spaced.questionPlaceholder")} value={newCard.question} onChange={(e) => setNewCard({ ...newCard, question: e.target.value })} rows={3} />
                      <Textarea placeholder={t("spaced.answerPlaceholder")} value={newCard.answer} onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })} rows={3} />
                      <Button onClick={addCard} className="w-full" disabled={addMutation.isPending}>{t("spaced.addCard")}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={startSession} className="gap-2 shadow-md" disabled={isReviewing}>
                  <Zap className="w-4 h-4" /> {t("spaced.startReview", { count: formatNumber(getReviewDeck.length) })}
                </Button>
              </div>
            </div>
          </div>

          {/* Review Mode Selector */}
          <ReviewModeSelector value={reviewMode} onChange={setReviewMode} dueTodayCount={dueCards.length} weakCount={weakCards.length} />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: Layers, label: t("spaced.stats.total"), value: cards.length, color: "text-foreground", iconColor: "text-muted-foreground" },
              { icon: Clock, label: t("spaced.stats.dueToday"), value: dueCards.length, color: "text-primary", iconColor: "text-primary" },
              { icon: BookOpen, label: t("spaced.stats.new"), value: newCards.length, color: "text-warning-foreground", iconColor: "text-warning" },
              { icon: TrendingUp, label: t("spaced.stats.learning"), value: learningCards.length, color: "text-success", iconColor: "text-success" },
              { icon: Target, label: t("spaced.stats.mastered"), value: masteredCards.length, color: "text-accent", iconColor: "text-accent" },
            ].map((stat) => (
              <Card key={stat.label} className="overflow-hidden">
                <CardContent className="p-4 text-center">
                  <stat.icon className={cn("w-5 h-5 mx-auto mb-1.5", stat.iconColor)} />
                  <p className="text-[11px] text-muted-foreground tracking-wider font-medium">{stat.label}</p>
                  <p className={cn("text-2xl font-bold mt-0.5", stat.color)}>{formatNumber(stat.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Retention Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" /> {t("spaced.retentionRate")}
                </span>
                <span className="text-sm font-bold text-accent">{formatPercent(retentionRate)}</span>
              </div>
              <Progress value={retentionRate} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-1.5">{t("spaced.retentionHint", { mastered: formatNumber(masteredCards.length), total: formatNumber(cards.length) })}</p>
            </CardContent>
          </Card>

          {/* Review Session */}
          {isReviewing && currentCard ? (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-accent to-success" style={{ width: `${((currentIndex + 1) / reviewDeckSize) * 100}%`, transition: "width 0.3s ease" }} />
              <CardContent className="p-6 sm:p-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-accent/30 text-accent">{currentCard.topic ?? t("spaced.generalTopic")}</Badge>
                    <MemoryStrengthBadge repetitions={currentCard.repetitions} easeFactor={currentCard.easeFactor} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium"><bdi>{formatNumber(currentIndex + 1)} / {formatNumber(reviewDeckSize)}</bdi></span>
                </div>
                <div className="text-center space-y-6">
                  <div className="py-4">
                    <p className="text-lg sm:text-xl font-semibold leading-relaxed">{currentCard.question}</p>
                  </div>
                  {showAnswer ? (
                    <>
                      <div className="border-t border-border pt-6 pb-2">
                        <p className="text-muted-foreground leading-relaxed">{currentCard.answer}</p>
                      </div>

                      {/* AI Explain Button */}
                      {!explanation && (
                        <Button variant="outline" size="sm" className="gap-2 border-accent/30 text-accent hover:bg-accent/10" onClick={explainCard} disabled={isExplaining}>
                          {isExplaining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                          {t("spaced.explainCard")}
                        </Button>
                      )}
                      {explanation && (
                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-start">
                          <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> {t("spaced.explanation")}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{explanation}</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">{t("spaced.howWell")}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(["again", "hard", "good", "easy"] as Difficulty[]).map((d) => {
                          const cfg = difficultyConfig[d];
                          const Icon = cfg.icon;
                          return (
                            <Button key={d} variant="outline" onClick={() => handleRate(d)} className={cn("flex flex-col gap-1 h-auto py-3", cfg.color)}>
                              <Icon className="w-4 h-4" />
                              <span className="text-xs font-semibold">{t(`spaced.rating.${d}`)}</span>
                              <span className="text-[10px] opacity-60">{getIntervalLabel(currentCard, d)}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Button onClick={() => setShowAnswer(true)} size="lg" className="mt-4 shadow-md gap-2">
                      <BookOpen className="w-4 h-4" /> {t("spaced.showAnswer")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : sessionStats.reviewed > 0 ? (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-success to-primary w-full" />
              <CardContent className="p-8 max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-bold mb-2">{t("spaced.sessionComplete")}</h2>
                <p className="text-muted-foreground mb-6">{t("spaced.reviewedCount", { count: sessionStats.reviewed })}</p>
                <div className="flex justify-center gap-6 text-sm mb-6">
                  <div className="text-center"><p className="text-lg font-bold text-destructive">{formatNumber(sessionStats.again)}</p><p className="text-[11px] text-muted-foreground">{t("spaced.rating.again")}</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-warning-foreground">{formatNumber(sessionStats.hard)}</p><p className="text-[11px] text-muted-foreground">{t("spaced.rating.hard")}</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-success">{formatNumber(sessionStats.good)}</p><p className="text-[11px] text-muted-foreground">{t("spaced.rating.good")}</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-primary">{formatNumber(sessionStats.easy)}</p><p className="text-[11px] text-muted-foreground">{t("spaced.rating.easy")}</p></div>
                </div>
                <Button onClick={startSession} className="gap-2" disabled={getReviewDeck.length === 0}>
                  <RotateCcw className="w-4 h-4" /> {t("spaced.reviewAgain", { count: formatNumber(getReviewDeck.length) })}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Forgetting Curve Chart */}
          <ForgettingCurveChart cards={cards} />

          {/* All Cards with Memory Strength */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" /> {t("spaced.allCards")}
                <Badge variant="secondary" className="ms-auto text-[11px]">{formatNumber(cards.length)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {cards.length === 0 && !cardsQuery.isError && (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("spaced.empty")}</p>
                )}
                {cards.map((card) => {
                  const isDue = card.nextReview <= new Date();
                  const statusColor = card.isMastered ? "bg-accent" : card.repetitions > 0 ? "bg-success" : "bg-muted-foreground";
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors group">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{card.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{card.topic ?? t("spaced.generalTopic")}</Badge>
                          <MemoryStrengthBadge repetitions={card.repetitions} easeFactor={card.easeFactor} />
                          <span className="text-[10px] text-muted-foreground">
                            {card.repetitions === 0 ? t("spaced.stats.new") : card.isMastered ? t("spaced.stats.mastered") : t("spaced.reviewsCount", { count: card.repetitions })}
                          </span>
                        </div>
                      </div>
                      {isDue ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] flex-shrink-0">{t("spaced.due")}</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {t("spaced.next", { days: t("spaced.daysShort", { count: Math.ceil((card.nextReview.getTime() - Date.now()) / 86400000) }) })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="border-accent/15 bg-gradient-to-r from-accent/5 to-primary/5">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">{t("spaced.tips.title")}</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li><Trans i18nKey="learning:spaced.tips.easy" components={{ b: <strong className="font-semibold text-foreground" /> }} /></li>
                <li><Trans i18nKey="learning:spaced.tips.hard" components={{ b: <strong className="font-semibold text-foreground" /> }} /></li>
                <li><Trans i18nKey="learning:spaced.tips.generate" components={{ b: <strong className="font-semibold text-foreground" /> }} /></li>
                <li><Trans i18nKey="learning:spaced.tips.explain" components={{ b: <strong className="font-semibold text-foreground" /> }} /></li>
                <li><Trans i18nKey="learning:spaced.tips.curve" components={{ b: <strong className="font-semibold text-foreground" /> }} /></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SpacedRepetition;
