import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Trophy, Star, Award, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { fetchInstructorTrainerRows } from "@/hooks/useEnrolledTrainers";
import { getApiError } from "@/lib/api";

const MEDALS = ["🥇", "🥈", "🥉"];

interface RankedTrainer {
  id: string;
  name: string;
  avatarUrl: string | null;
  lessons: number;
  avgScore: number | null;
  completedCourses: number;
}

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const InstructorLeaderboard = () => {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["instructor-trainers", "all"],
    queryFn: () => fetchInstructorTrainerRows(),
  });

  // Ranked by lessons completed across the instructor's courses, then by average quiz score.
  const ranking = useMemo<RankedTrainer[]>(() => {
    const map = new Map<string, RankedTrainer & { scores: number[] }>();
    rows.forEach((r) => {
      const entry = map.get(r.TrainerId) ?? {
        id: r.TrainerId, name: r.FullName, avatarUrl: r.AvatarUrl, lessons: 0, avgScore: null, completedCourses: 0, scores: [],
      };
      entry.lessons += r.LessonsCompleted;
      if (r.CompletedAt) entry.completedCourses += 1;
      if (r.QuizAverage != null) entry.scores.push(r.QuizAverage);
      map.set(r.TrainerId, entry);
    });
    return Array.from(map.values())
      .map(({ scores, ...t }) => ({
        ...t,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      }))
      .sort((a, b) => b.lessons - a.lessons || (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [rows]);

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Trainer Leaderboard</h1>
            <p className="text-muted-foreground text-sm">Top performing trainers across your courses, ranked by lessons completed</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-center text-destructive py-12">{getApiError(error, "Failed to load the leaderboard.")}</p>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No trainers are enrolled in your courses yet.</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <section className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            {ranking.slice(0, 3).map((trainer, i) => (
              <Card key={trainer.id} className={`shadow-soft border-border/50 text-center ${i === 0 ? "ring-2 ring-warning/30" : ""}`}>
                <CardContent className="pt-6 pb-4">
                  <div className="text-3xl mb-2">{MEDALS[i]}</div>
                  <Avatar className="w-14 h-14 mx-auto mb-2">
                    <AvatarImage src={trainer.avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(trainer.name)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-sm">{trainer.name}</h3>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3.5 h-3.5 text-warning" />
                    <span className="font-bold text-sm">{trainer.lessons.toLocaleString()} lessons</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Award className="w-3 h-3 text-accent" />{trainer.avgScore != null ? `${trainer.avgScore}% quiz avg` : "No quizzes"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Full List */}
          <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Card className="shadow-soft border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Full Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ranking.map((trainer, i) => (
                    <div key={trainer.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <span className="w-8 text-center font-bold text-muted-foreground">#{i + 1}</span>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={trainer.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(trainer.name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">{trainer.name}</span>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-warning" />{trainer.lessons.toLocaleString()}</span>
                        <span>{trainer.avgScore != null ? `${trainer.avgScore}%` : "-"}</span>
                        <Badge variant="secondary" className="text-[10px]">{trainer.completedCourses} completed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </InstructorPageLayout>
  );
};

export default InstructorLeaderboard;
