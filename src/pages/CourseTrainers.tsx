import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
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
import { getApiError } from "@/lib/api";

const CourseTrainers = () => {
  const { t } = useTranslation("instructor");
  const { formatDate, formatPercent, formatNumber } = useFormatters();
  const { courseId } = useParams<{ courseId: string }>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const { trainers, loading, error } = useEnrolledTrainers(courseId);
  const { courses, fetchInstructorCourses } = useCourses();

  useEffect(() => {
    fetchInstructorCourses();
  }, [fetchInstructorCourses]);

  const courseTitle = courses.find((c) => c.Id === courseId)?.Title ?? trainers[0]?.CourseTitle ?? t("trainers.course.fallbackCourse");

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
          sidebarCollapsed ? "ms-20" : "ms-64"
        )}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label={t("trainers.course.back")} onClick={() => navigate("/instructor/courses")}>
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t("trainers.course.title")}</h1>
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
                    <p className="text-2xl font-bold">{formatNumber(trainers.length)}</p>
                    <p className="text-xs text-muted-foreground">{t("trainers.course.stats.total")}</p>
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
                      {formatNumber(trainers.filter(s => s.CompletedAt).length)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("trainers.course.stats.completed")}</p>
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
                      {formatPercent(Math.round(trainers.reduce((sum, s) => sum + s.ProgressPercentage, 0) / (trainers.length || 1)))}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("trainers.course.stats.avgProgress")}</p>
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
                    <p className="text-2xl font-bold">{avgQuiz != null ? formatPercent(avgQuiz) : "-"}</p>
                    <p className="text-xs text-muted-foreground">{t("trainers.course.stats.avgQuiz")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trainers Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("trainers.course.list")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive">{getApiError(error, t("trainers.course.loadFailed"))}</p>
                </div>
              ) : trainers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("trainers.course.empty")}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("trainers.course.columns.trainer")}</TableHead>
                      <TableHead>{t("trainers.course.columns.enrolled")}</TableHead>
                      <TableHead>{t("trainers.course.columns.progress")}</TableHead>
                      <TableHead>{t("trainers.course.columns.lessons")}</TableHead>
                      <TableHead>{t("trainers.course.columns.avgScore")}</TableHead>
                      <TableHead>{t("trainers.course.columns.lastActive")}</TableHead>
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
                              <p className="font-medium">{trainer.FullName ?? t("common:deletedUser")}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">{trainer.Email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(trainer.EnrolledAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={trainer.ProgressPercentage} className="w-20 h-2" />
                            <span className="text-sm">{formatPercent(Math.round(trainer.ProgressPercentage))}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(trainer.LessonsCompleted)}</TableCell>
                        <TableCell>
                          {trainer.QuizAverage != null ? formatPercent(Math.round(trainer.QuizAverage)) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {trainer.LastActive ? formatDate(trainer.LastActive) : t("trainers.course.never")}
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
