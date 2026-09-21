import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import {
    FlashcardDeckCard,
    FlashcardStudy,
    mockDecks,
    mockFlashcards,
    getFlashcardsForDeck,
    FlashcardDeck,
    Flashcard
} from "@/components/flashcards";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Layers,
    Brain,
    TrendingUp,
    Clock,
    Plus,
    Trophy,
    ArrowLeft
} from "lucide-react";

const Flashcards = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t } = useTranslation(["learning", "common"]);
    const { formatNumber, formatPercent } = useFormatters();
    const [decks, setDecks] = useState<FlashcardDeck[]>(mockDecks);
    const [flashcards, setFlashcards] = useState<Record<string, Flashcard[]>>(mockFlashcards);
    const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);
    const [showResults, setShowResults] = useState<{ correct: number; total: number } | null>(null);

    // Create Deck State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newDeckName, setNewDeckName] = useState("");
    const [newDeckTopic, setNewDeckTopic] = useState("");
    const [initialCardFront, setInitialCardFront] = useState("");
    const [initialCardBack, setInitialCardBack] = useState("");

    const studyingDeck = studyingDeckId
        ? decks.find(d => d.id === studyingDeckId)
        : null;
    const studyCards = studyingDeckId
        ? flashcards[studyingDeckId] || []
        : [];

    // Stats
    const stats = {
        totalCards: decks.reduce((sum, d) => sum + d.cardCount, 0),
        masteredCards: decks.reduce((sum, d) => sum + d.masteredCount, 0),
        dueCards: decks.reduce((sum, d) => sum + d.dueCount, 0),
        decksStudied: decks.filter(d => d.lastStudied).length,
    };

    const handleStartStudy = (deckId: string) => {
        setStudyingDeckId(deckId);
        setShowResults(null);
    };

    const handleCompleteStudy = (results: { correct: number; total: number }) => {
        setShowResults(results);
    };

    const handleExitStudy = () => {
        setStudyingDeckId(null);
        setShowResults(null);
    };

    const handleCreateDeck = () => {
        if (!newDeckName.trim() || !newDeckTopic.trim() || !initialCardFront.trim() || !initialCardBack.trim()) return;

        const deckId = crypto.randomUUID();
        const newDeck: FlashcardDeck = {
            id: deckId,
            name: newDeckName,
            description: newDeckTopic,
            category: "General",
            cardCount: 1,
            masteredCount: 0,
            dueCount: 1,
            color: "from-blue-500 to-cyan-600",
            icon: "BookOpen",
            lastStudied: undefined
        };

        const newCard = {
            id: crypto.randomUUID(),
            deckId: deckId,
            front: initialCardFront,
            back: initialCardBack,
            difficulty: "new" as const,
            correctCount: 0,
            incorrectCount: 0,
            streak: 0,
        };

        setFlashcards(prev => ({
            ...prev,
            [deckId]: [newCard]
        }));
        setDecks(prev => [newDeck, ...prev]);
        setIsCreateOpen(false);
        setNewDeckName("");
        setNewDeckTopic("");
        setInitialCardFront("");
        setInitialCardBack("");
    };

    const handleNextDeck = () => {
        const currentIndex = decks.findIndex(d => d.id === studyingDeckId);
        if (currentIndex < decks.length - 1) {
            setStudyingDeckId(decks[currentIndex + 1].id);
            setShowResults(null);
        }
    };

    const handlePrevDeck = () => {
        const currentIndex = decks.findIndex(d => d.id === studyingDeckId);
        if (currentIndex > 0) {
            setStudyingDeckId(decks[currentIndex - 1].id);
            setShowResults(null);
        }
    };

    const currentIndex = decks.findIndex(d => d.id === studyingDeckId);
    const hasNextDeck = currentIndex !== -1 && currentIndex < decks.length - 1;
    const hasPrevDeck = currentIndex > 0;

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Trainer"
                mobileSidebar={<ApplicantSidebarContent />}
            />

            <main
                className={cn(
                    "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                    sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                    "ms-0"
                )}
            >
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
                                <p className="text-muted-foreground">
                                    {t("flashcards.subtitle")}
                                </p>
                            </div>
                            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                {t("flashcards.createDeck")}
                            </Button>
                        </div>
                    </section>

                    {/* Stats Cards */}
                    <section
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up"
                        style={{ animationDelay: "100ms" }}
                    >
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
                                    <p className="text-2xl font-bold">{formatNumber(stats.decksStudied)}</p>
                                    <p className="text-xs text-muted-foreground">{t("flashcards.decksActive")}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Due Today Section */}
                    {stats.dueCards > 0 && (
                        <section className="animate-slide-up" style={{ animationDelay: "150ms" }}>
                            <div className="rounded-2xl bg-gradient-to-r from-warning/10 to-orange-500/10 border border-warning/20 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold mb-1">{t("flashcards.dueForReview")}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {t("flashcards.dueSummary", { cards: stats.dueCards, decks: decks.filter(d => d.dueCount > 0).length })}
                                        </p>
                                    </div>
                                    <Button
                                        className="gap-2"
                                        onClick={() => {
                                            const deckWithDue = decks.find(d => d.dueCount > 0);
                                            if (deckWithDue) handleStartStudy(deckWithDue.id);
                                        }}
                                    >
                                        <Brain className="w-4 h-4" />
                                        {t("flashcards.startReview")}
                                    </Button>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Deck Grid */}
                    <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                        <h2 className="text-lg font-semibold mb-4">{t("flashcards.yourDecks")}</h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {decks.map((deck) => (
                                <FlashcardDeckCard
                                    key={deck.id}
                                    deck={deck}
                                    onClick={() => handleStartStudy(deck.id)}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            {/* Create Deck Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("flashcards.createTitle")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">{t("flashcards.deckName")}</Label>
                            <Input
                                id="name"
                                placeholder={t("flashcards.deckNamePlaceholder")}
                                value={newDeckName}
                                onChange={(e) => setNewDeckName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="topic">{t("flashcards.topic")}</Label>
                            <Input
                                id="topic"
                                placeholder={t("flashcards.topicPlaceholder")}
                                value={newDeckTopic}
                                onChange={(e) => setNewDeckTopic(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {t("flashcards.addInitial")}
                            </h4>
                            <div className="space-y-2">
                                <Label htmlFor="front">{t("flashcards.front")}</Label>
                                <Input
                                    id="front"
                                    placeholder={t("flashcards.frontPlaceholder")}
                                    value={initialCardFront}
                                    onChange={(e) => setInitialCardFront(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="back">{t("flashcards.back")}</Label>
                                <Input
                                    id="back"
                                    placeholder={t("flashcards.backPlaceholder")}
                                    value={initialCardBack}
                                    onChange={(e) => setInitialCardBack(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleCreateDeck} disabled={!newDeckName || !newDeckTopic || !initialCardFront || !initialCardBack}>{t("flashcards.createDeck")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Study Modal */}
            <Dialog open={!!studyingDeckId} onOpenChange={(open) => !open && handleExitStudy()}>
                <DialogContent className="max-w-4xl h-[90vh] p-6">
                    {showResults ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                                <Trophy className="w-10 h-10 text-success" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{t("flashcards.complete")}</h2>
                            <p className="text-muted-foreground mb-6">
                                {t("flashcards.resultLine", { correct: formatNumber(showResults.correct), total: formatNumber(showResults.total) })}
                            </p>
                            <div className="text-5xl font-bold text-primary mb-8">
                                {formatPercent(Number.isNaN((showResults.correct / showResults.total)) ? 0 : (showResults.correct / showResults.total) * 100)}
                            </div>
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={handleExitStudy}>
                                    <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                                    {t("flashcards.backToDecks")}
                                </Button>
                                <Button onClick={() => setShowResults(null)}>
                                    {t("flashcards.studyAgain")}
                                </Button>
                            </div>
                        </div>
                    ) : studyingDeck ? (
                        studyCards.length > 0 ? (
                            <FlashcardStudy
                                cards={studyCards}
                                deckName={studyingDeck.name}
                                onComplete={handleCompleteStudy}
                                onExit={handleExitStudy}
                                onNextDeck={handleNextDeck}
                                onPrevDeck={handlePrevDeck}
                                hasNextDeck={hasNextDeck}
                                hasPrevDeck={hasPrevDeck}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p className="text-muted-foreground">{t("flashcards.noCards")}</p>
                                <Button variant="outline" className="mt-4" onClick={handleExitStudy}>
                                    {t("flashcards.goBack")}
                                </Button>
                            </div>
                        )
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Flashcards;
