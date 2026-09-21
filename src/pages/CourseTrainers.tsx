import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useEnrolledTrainers } from "@/hooks/useEnrolledTrainers";
import { useCourses } from "@/hooks/useCourses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Users, BookOpen, Clock, Trophy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getApiError } from "@/lib/api";

const CourseTrainers = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const { trainers, loading, error } = useEnrolledTrainers(courseId);
  const { courses, fetchInstructorCourses } = useCourses();

  useEffect(() => {
    fetchInstructorCourses();
  }, [fetchInstructorCourses]);

  const courseTitle = courses.find((c) => c.Id === courseId)?.Title ?? trainers[0]?.CourseTitle ?? "Course";

  const scored = trainers.filter((t) => t.QuizAverage != null);
  const avgQuiz = scored.length
    ? Math.round(scored.reduce((sum, t) => sum + (t.QuizAverage ?? 0), 0) / scored.length)
    : null;

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <InstructorSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Instructor" />

      <main
        className={cn(
          "pt-20 pb-8 px-6 transition-all duration-300",
          sidebarCollapsed ? "ml-20" : "ml-64"
        )}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/instructor/courses")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Enrolled Trainers</h1>
              <p className="text-muted-foreground">{courseTitle}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainers.length}</p>
                    <p className="text-xs text-muted-foreground">Total Trainers</p>
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
                    <p className="text-2xl font-bold">
                      {trainers.filter(s => s.CompletedAt).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.round(trainers.reduce((sum, s) => sum + s.ProgressPercentage, 0) / (trainers.length || 1))}%
                    </p>
                    <p className="text-xs text-muted-foreground">Avg. Progress</p>
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
                    <p className="text-2xl font-bold">{avgQuiz != null ? `${avgQuiz}%` : "-"}</p>
                    <p className="text-xs text-muted-foreground">Avg. Quiz Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trainers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trainer List</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive">{getApiError(error, "Failed to load trainers.")}</p>
                </div>
              ) : trainers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No trainers enrolled yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainer</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Lessons</TableHead>
                      <TableHead>Avg. Score</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainers.map((trainer) => (
                      <TableRow key={`${trainer.TrainerId}-${trainer.CourseId}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={trainer.AvatarUrl || undefined} />
                              <AvatarFallback>{getInitials(trainer.FullName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{trainer.FullName}</p>
                              <p className="text-xs text-muted-foreground">{trainer.Email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(trainer.EnrolledAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={trainer.ProgressPercentage} className="w-20 h-2" />
                            <span className="text-sm">{Math.round(trainer.ProgressPercentage)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{trainer.LessonsCompleted}</TableCell>
                        <TableCell>
                          {trainer.QuizAverage != null ? `${Math.round(trainer.QuizAverage)}%` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {trainer.LastActive ? format(new Date(trainer.LastActive), "MMM d, yyyy") : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CourseTrainers;
