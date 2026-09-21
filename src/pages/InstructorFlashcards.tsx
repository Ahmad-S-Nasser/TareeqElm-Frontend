import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Layers, Plus, Sparkles, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const mockDecks = [
  { id: 1, title: "Machine Learning Key Concepts", course: "ML 101", cards: 45, trainersUsing: 20, avgRetention: 82 },
  { id: 2, title: "Statistical Methods", course: "Statistics", cards: 30, trainersUsing: 25, avgRetention: 75 },
  { id: 3, title: "Business Models & Frameworks", course: "Business Strategy", cards: 20, trainersUsing: 18, avgRetention: 88 },
  { id: 4, title: "Neural Networks Vocabulary", course: "ML 101", cards: 35, trainersUsing: 15, avgRetention: 70 },
];

const InstructorFlashcards = () => {
  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Flashcards Manager</h1>
            </div>
            <p className="text-muted-foreground">Create and assign flashcard decks for your trainers</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Sparkles className="w-4 h-4 mr-2" /> AI Generate
            </Button>
            <Button className="gradient-accent text-white shadow-glow-accent">
              <Plus className="w-4 h-4 mr-2" /> Create Deck
            </Button>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {mockDecks.map((deck) => (
          <Card key={deck.id} className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{deck.title}</CardTitle>
              <CardDescription className="text-xs">{deck.course} • {deck.cards} cards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {deck.trainersUsing} trainers</span>
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {deck.avgRetention}% retention</span>
                </div>
                <Progress value={deck.avgRetention} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorFlashcards;
