import { useProgress, ProgressStats } from "@/hooks/useProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Trophy,
  Clock,
  Flame,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface ProgressDashboardProps {
  className?: string;
}

export const ProgressDashboard = ({ className }: ProgressDashboardProps) => {
  const { stats, quizResults, loading, error } = useProgress();

  if (loading) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  const recentQuizzes = quizResults.slice(0, 5);

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-destructive text-center py-6">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalLessonsCompleted || 0}</p>
                <p className="text-xs text-muted-foreground">Lessons Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalQuizzesTaken || 0}</p>
                <p className="text-xs text-muted-foreground">Quizzes Taken</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.averageQuizScore ? `${Math.round(stats.averageQuizScore)}%` : "-"}
                </p>
                <p className="text-xs text-muted-foreground">Avg. Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalStudyTimeMinutes || 0}</p>
                <p className="text-xs text-muted-foreground">Minutes Studied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Quiz Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Recent Quiz Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No quiz results yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentQuizzes.map((result) => (
                  <div key={result.Id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          result.Passed
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {result.Passed ? (
                          <Trophy className="w-4 h-4" />
                        ) : (
                          <Target className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {Math.round(Number(result.Percentage))}% Score
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(result.TakenAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Number(result.Percentage)}
                        className={`w-16 h-2 ${
                          result.Passed ? "" : "[&>div]:bg-destructive"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Study Streak */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Study Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-warning to-destructive flex items-center justify-center mb-3 mx-auto">
                  <Flame className="w-10 h-10 text-white" />
                </div>
                <p className="text-3xl font-bold">{stats?.currentStreak || 0}</p>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                    i < (stats?.currentStreak || 0)
                      ? "bg-warning/20 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {["S", "M", "T", "W", "T", "F", "S"][i]}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
