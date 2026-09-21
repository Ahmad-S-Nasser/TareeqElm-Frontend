import { useState } from "react";
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
                    sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                    "ml-0"
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
                                    <h1 className="text-2xl font-bold">Flashcards</h1>
                                </div>
                                <p className="text-muted-foreground">
                                    Master concepts with spaced repetition learning
                                </p>
                            </div>
                            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Create Deck
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
                                    <p className="text-2xl font-bold">{stats.totalCards}</p>
                                    <p className="text-xs text-muted-foreground">Total Cards</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                    <Trophy className="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.masteredCards}</p>
                                    <p className="text-xs text-muted-foreground">Mastered</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-warning" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.dueCards}</p>
                                    <p className="text-xs text-muted-foreground">Due Today</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.decksStudied}</p>
                                    <p className="text-xs text-muted-foreground">Decks Active</p>
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
                                        <h2 className="text-lg font-semibold mb-1">Cards Due for Review</h2>
                                        <p className="text-sm text-muted-foreground">
                                            You have {stats.dueCards} cards across {decks.filter(d => d.dueCount > 0).length} decks ready for review
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
                                        Start Review
                                    </Button>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Deck Grid */}
                    <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                        <h2 className="text-lg font-semibold mb-4">Your Decks</h2>
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
                        <DialogTitle>Create New Deck</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Deck Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., JavaScript Basics"
                                value={newDeckName}
                                onChange={(e) => setNewDeckName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="topic">Topic / Description</Label>
                            <Input
                                id="topic"
                                placeholder="e.g., Core language concepts"
                                value={newDeckTopic}
                                onChange={(e) => setNewDeckTopic(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Add Initial Card
                            </h4>
                            <div className="space-y-2">
                                <Label htmlFor="front">Question (Front)</Label>
                                <Input
                                    id="front"
                                    placeholder="Enter question"
                                    value={initialCardFront}
                                    onChange={(e) => setInitialCardFront(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="back">Answer (Back)</Label>
                                <Input
                                    id="back"
                                    placeholder="Enter answer"
                                    value={initialCardBack}
                                    onChange={(e) => setInitialCardBack(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateDeck} disabled={!newDeckName || !newDeckTopic || !initialCardFront || !initialCardBack}>Create Deck</Button>
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
                            <h2 className="text-2xl font-bold mb-2">Study Session Complete!</h2>
                            <p className="text-muted-foreground mb-6">
                                You got {showResults.correct} out of {showResults.total} cards correct
                            </p>
                            <div className="text-5xl font-bold text-primary mb-8">
                                {Number.isNaN((showResults.correct / showResults.total)) ? 0 : Math.round((showResults.correct / showResults.total) * 100)}%
                            </div>
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={handleExitStudy}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Decks
                                </Button>
                                <Button onClick={() => setShowResults(null)}>
                                    Study Again
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
                                <p className="text-muted-foreground">No cards in this deck yet.</p>
                                <Button variant="outline" className="mt-4" onClick={handleExitStudy}>
                                    Go Back
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
