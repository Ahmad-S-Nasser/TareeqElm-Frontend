import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import api, { getApiError } from "@/lib/api";
import { ReviewModeSelector, type ReviewMode } from "@/components/spaced-repetition/ReviewModeSelector";
import { MemoryStrengthBadge } from "@/components/spaced-repetition/MemoryStrengthBadge";
import { ForgettingCurveChart } from "@/components/spaced-repetition/ForgettingCurveChart";

interface ReviewCard {
  id: string;
  question: string;
  answer: string;
  topic: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: Date;
  lastReviewed: Date | null;
}

type Difficulty = "again" | "hard" | "good" | "easy";

interface FlashcardDto {
  Id: string;
  Topic: string | null;
  Question: string;
  Answer: string;
  EaseFactor: number;
  IntervalDays: number;
  Repetitions: number;
  NextReview: string;
  LastReviewed: string | null;
}

const toCard = (d: FlashcardDto): ReviewCard => ({
  id: d.Id,
  question: d.Question,
  answer: d.Answer,
  topic: d.Topic || "General",
  interval: d.IntervalDays,
  easeFactor: Number(d.EaseFactor),
  repetitions: d.Repetitions,
  nextReview: new Date(d.NextReview),
  lastReviewed: d.LastReviewed ? new Date(d.LastReviewed) : null,
});

const difficultyConfig = {
  again: { label: "Again", icon: XCircle, color: "border-destructive/30 text-destructive hover:bg-destructive/10", interval: "1d" },
  hard: { label: "Hard", icon: RotateCcw, color: "border-warning/30 text-warning-foreground hover:bg-warning/10", interval: "" },
  good: { label: "Good", icon: CheckCircle2, color: "border-success/30 text-success hover:bg-success/10", interval: "" },
  easy: { label: "Easy", icon: Zap, color: "border-primary/30 text-primary hover:bg-primary/10", interval: "" },
};

const SpacedRepetition = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({ question: "", answer: "", topic: "General" });
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all-due");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [generateTopic, setGenerateTopic] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["flashcards", "review"],
    queryFn: async () => (await api.get<FlashcardDto[]>("/Flashcards")).data.map(toCard),
  });
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

  const calculateNextInterval = (card: ReviewCard, difficulty: Difficulty) => {
    let { interval, easeFactor, repetitions } = card;
    switch (difficulty) {
      case "again": interval = 1; easeFactor = Math.max(1.3, easeFactor - 0.2); repetitions = 0; break;
      case "hard": interval = Math.max(1, Math.round(interval * 1.2)); easeFactor = Math.max(1.3, easeFactor - 0.15); repetitions += 1; break;
      case "good": interval = repetitions === 0 ? 1 : repetitions === 1 ? 4 : Math.round(interval * easeFactor); repetitions += 1; break;
      case "easy": interval = repetitions === 0 ? 4 : Math.round(interval * easeFactor * 1.3); easeFactor += 0.15; repetitions += 1; break;
    }
    return { interval, easeFactor, repetitions, nextReview: new Date(Date.now() + interval * 86400000), lastReviewed: new Date() };
  };

  const getIntervalLabel = (card: ReviewCard, difficulty: Difficulty) => {
    const result = calculateNextInterval({ ...card }, difficulty);
    return `${result.interval}d`;
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: Difficulty }) =>
      toCard((await api.post<FlashcardDto>(`/Flashcards/${id}/review`, { Rating: rating })).data),
    onSuccess: (updated) => {
      // The server owns the scheduling; store its result without refetching the deck mid-session
      queryClient.setQueryData<ReviewCard[]>(["flashcards", "review"], (prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
    },
    onError: (err) => toast.error(getApiError(err, "Failed to save review")),
  });

  const handleRate = async (difficulty: Difficulty) => {
    if (!currentCard || reviewMutation.isPending) return;
    try {
      await reviewMutation.mutateAsync({ id: currentCard.id, rating: difficulty });
    } catch {
      return;
    }
    setSessionStats((prev) => ({ ...prev, reviewed: prev.reviewed + 1, [difficulty]: prev[difficulty] + 1 }));
    setShowAnswer(false);
    setExplanation(null);
    if (currentIndex + 1 >= reviewDeckSize) {
      setIsReviewing(false);
      toast.success(`Session complete! Reviewed ${sessionStats.reviewed + 1} cards.`);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const startSession = () => {
    const deck = getReviewDeck;
    if (deck.length === 0) { toast.info("No cards available for this mode!"); return; }
    setSessionIds(deck.map((c) => c.id));
    setCurrentIndex(0); setShowAnswer(false); setExplanation(null);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
    setIsReviewing(true);
  };

  const addMutation = useMutation({
    mutationFn: async () => (await api.post<FlashcardDto>("/Flashcards", {
      Question: newCard.question, Answer: newCard.answer, Topic: newCard.topic || "General",
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      setNewCard({ question: "", answer: "", topic: "General" });
      setAddDialogOpen(false);
      toast.success("Card added!");
    },
    onError: (err) => toast.error(getApiError(err, "Failed to save card")),
  });

  const addCard = () => {
    if (!newCard.question || !newCard.answer) { toast.error("Fill question and answer"); return; }
    addMutation.mutate();
  };

  // Explain the current card (template-based explanation from the server)
  const explainMutation = useMutation({
    mutationFn: async (id: string) => (await api.post<{ Explanation: string; Generator: string }>(`/Flashcards/${id}/explain`)).data,
    onSuccess: (data) => setExplanation(data.Explanation || "No explanation available."),
    onError: (err) => toast.error(getApiError(err, "Failed to get explanation")),
  });
  const isExplaining = explainMutation.isPending;
  const explainCard = () => { if (currentCard) explainMutation.mutate(currentCard.id); };

  // Generate cards for a topic (server saves them)
  const generateMutation = useMutation({
    mutationFn: async (topic: string) => (await api.post<FlashcardDto[]>("/Flashcards/generate", { Topic: topic, Count: 8 })).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      if (created.length === 0) { toast.info("No cards generated. Try a different topic."); return; }
      setGenerateTopic("");
      setGenerateDialogOpen(false);
      toast.success(`Generated ${created.length} flashcards!`);
    },
    onError: (err) => toast.error(getApiError(err, "Failed to generate cards")),
  });
  const isGeneratingCards = generateMutation.isPending;
  const generateCards = () => {
    if (!generateTopic.trim()) { toast.error("Enter a topic"); return; }
    generateMutation.mutate(generateTopic.trim());
  };

  const masteredCards = cards.filter((c) => c.repetitions >= 3);
  const learningCards = cards.filter((c) => c.repetitions > 0 && c.repetitions < 3);
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

      <main className={cn("pt-20 pb-10 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ml-20" : "lg:ml-64", "ml-0")}>
        <div className="max-w-5xl mx-auto space-y-6">
          {cardsQuery.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="flex-1">{getApiError(cardsQuery.error, "Failed to load flashcards")}</span>
              <Button size="sm" variant="outline" onClick={() => cardsQuery.refetch()}>Retry</Button>
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
                  Spaced Repetition
                </h1>
                <p className="text-muted-foreground text-sm mt-2 max-w-md">Master your knowledge with scientifically-proven interval-based review.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-accent/30 text-accent hover:bg-accent/10">
                      <Wand2 className="w-4 h-4" /> AI Generate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> AI Flashcard Generator</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">Enter a topic and the AI will generate study flashcards for you.</p>
                      <Input placeholder="e.g. React Hooks, Calculus Derivatives, World War II" value={generateTopic} onChange={(e) => setGenerateTopic(e.target.value)} />
                      <Button onClick={generateCards} className="w-full gap-2" disabled={isGeneratingCards}>
                        {isGeneratingCards ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {isGeneratingCards ? "Generating..." : "Generate Flashcards"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add Card</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Review Card</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <Input placeholder="Topic (e.g. Test Design)" value={newCard.topic} onChange={(e) => setNewCard({ ...newCard, topic: e.target.value })} />
                      <Textarea placeholder="Question" value={newCard.question} onChange={(e) => setNewCard({ ...newCard, question: e.target.value })} rows={3} />
                      <Textarea placeholder="Answer" value={newCard.answer} onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })} rows={3} />
                      <Button onClick={addCard} className="w-full" disabled={addMutation.isPending}>Add Card</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={startSession} className="gap-2 shadow-md" disabled={isReviewing}>
                  <Zap className="w-4 h-4" /> Start Review ({getReviewDeck.length})
                </Button>
              </div>
            </div>
          </div>

          {/* Review Mode Selector */}
          <ReviewModeSelector value={reviewMode} onChange={setReviewMode} dueTodayCount={dueCards.length} weakCount={weakCards.length} />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: Layers, label: "Total Cards", value: cards.length, color: "text-foreground", iconColor: "text-muted-foreground" },
              { icon: Clock, label: "Due Today", value: dueCards.length, color: "text-primary", iconColor: "text-primary" },
              { icon: BookOpen, label: "New", value: newCards.length, color: "text-warning-foreground", iconColor: "text-warning" },
              { icon: TrendingUp, label: "Learning", value: learningCards.length, color: "text-success", iconColor: "text-success" },
              { icon: Target, label: "Mastered", value: masteredCards.length, color: "text-accent", iconColor: "text-accent" },
            ].map((stat) => (
              <Card key={stat.label} className="overflow-hidden">
                <CardContent className="p-4 text-center">
                  <stat.icon className={cn("w-5 h-5 mx-auto mb-1.5", stat.iconColor)} />
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                  <p className={cn("text-2xl font-bold mt-0.5", stat.color)}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Retention Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" /> Retention Rate
                </span>
                <span className="text-sm font-bold text-accent">{retentionRate}%</span>
              </div>
              <Progress value={retentionRate} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-1.5">{masteredCards.length} of {cards.length} cards mastered (3+ successful reviews)</p>
            </CardContent>
          </Card>

          {/* Review Session */}
          {isReviewing && currentCard ? (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-accent to-success" style={{ width: `${((currentIndex + 1) / reviewDeckSize) * 100}%`, transition: "width 0.3s ease" }} />
              <CardContent className="p-6 sm:p-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-accent/30 text-accent">{currentCard.topic}</Badge>
                    <MemoryStrengthBadge repetitions={currentCard.repetitions} easeFactor={currentCard.easeFactor} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{currentIndex + 1} / {reviewDeckSize}</span>
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
                          Explain This Card
                        </Button>
                      )}
                      {explanation && (
                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-left">
                          <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Explanation</p>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{explanation}</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">How well did you remember?</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(["again", "hard", "good", "easy"] as Difficulty[]).map((d) => {
                          const cfg = difficultyConfig[d];
                          const Icon = cfg.icon;
                          return (
                            <Button key={d} variant="outline" onClick={() => handleRate(d)} className={cn("flex flex-col gap-1 h-auto py-3", cfg.color)}>
                              <Icon className="w-4 h-4" />
                              <span className="text-xs font-semibold">{cfg.label}</span>
                              <span className="text-[10px] opacity-60">{getIntervalLabel(currentCard, d)}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Button onClick={() => setShowAnswer(true)} size="lg" className="mt-4 shadow-md gap-2">
                      <BookOpen className="w-4 h-4" /> Show Answer
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
                <h2 className="text-xl font-bold mb-2">Session Complete!</h2>
                <p className="text-muted-foreground mb-6">You reviewed {sessionStats.reviewed} cards</p>
                <div className="flex justify-center gap-6 text-sm mb-6">
                  <div className="text-center"><p className="text-lg font-bold text-destructive">{sessionStats.again}</p><p className="text-[11px] text-muted-foreground">Again</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-warning-foreground">{sessionStats.hard}</p><p className="text-[11px] text-muted-foreground">Hard</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-success">{sessionStats.good}</p><p className="text-[11px] text-muted-foreground">Good</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-primary">{sessionStats.easy}</p><p className="text-[11px] text-muted-foreground">Easy</p></div>
                </div>
                <Button onClick={startSession} className="gap-2" disabled={getReviewDeck.length === 0}>
                  <RotateCcw className="w-4 h-4" /> Review Again ({getReviewDeck.length})
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
                <Layers className="w-4 h-4 text-muted-foreground" /> All Cards
                <Badge variant="secondary" className="ml-auto text-[11px]">{cards.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {cards.length === 0 && !cardsQuery.isError && (
                  <p className="text-sm text-muted-foreground text-center py-6">No flashcards yet. Add a card or use AI Generate to create some from a topic.</p>
                )}
                {cards.map((card) => {
                  const isDue = card.nextReview <= new Date();
                  const statusColor = card.repetitions >= 3 ? "bg-accent" : card.repetitions > 0 ? "bg-success" : "bg-muted-foreground";
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors group">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{card.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{card.topic}</Badge>
                          <MemoryStrengthBadge repetitions={card.repetitions} easeFactor={card.easeFactor} />
                          <span className="text-[10px] text-muted-foreground">
                            {card.repetitions === 0 ? "New" : card.repetitions >= 3 ? "Mastered" : `${card.repetitions} reviews`}
                          </span>
                        </div>
                      </div>
                      {isDue ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] flex-shrink-0">Due</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          Next: {Math.ceil((card.nextReview.getTime() - Date.now()) / 86400000)}d
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
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">🧠 How Spaced Repetition Works</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• Cards you find <strong>easy</strong> appear less frequently (longer intervals).</li>
                <li>• Cards you struggle with (<strong>again/hard</strong>) reset to shorter intervals.</li>
                <li>• Use <strong>AI Generate</strong> to create flashcards from any topic instantly.</li>
                <li>• Click <strong>Explain This Card</strong> during review for AI-powered explanations.</li>
                <li>• The <strong>forgetting curve</strong> shows why regular review matters.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SpacedRepetition;
