import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { ClipboardList, Plus, Clock, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const mockAssignments = [
  { id: 1, due: "2026-03-15", submissions: 18, total: 24, graded: 12, status: "active" },
  { id: 2, due: "2026-03-20", submissions: 8, total: 30, graded: 0, status: "active" },
  { id: 3, due: "2026-03-10", submissions: 22, total: 22, graded: 22, status: "completed" },
  { id: 4, due: "2026-03-25", submissions: 0, total: 24, graded: 0, status: "upcoming" },
];

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  upcoming: "bg-warning/10 text-warning",
};

const InstructorAssignments = () => {
  const { t } = useTranslation("instructor");
  const { formatDate, formatNumber } = useFormatters();
  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("assignments.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("assignments.subtitle")}</p>
          </div>
          <Button className="gradient-accent text-white shadow-glow-accent">
            <Plus className="w-4 h-4 me-2" /> {t("assignments.create")}
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <Card className="shadow-soft border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="w-4 h-4 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">{t("assignments.stats.total")}</p><p className="text-xl font-bold">{formatNumber(mockAssignments.length)}</p></div>
          </div>
        </Card>
        <Card className="shadow-soft border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Clock className="w-4 h-4 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">{t("assignments.stats.pending")}</p><p className="text-xl font-bold">{formatNumber(14)}</p></div>
          </div>
        </Card>
        <Card className="shadow-soft border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="w-4 h-4 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">{t("assignments.stats.graded")}</p><p className="text-xl font-bold">{formatNumber(34)}</p></div>
          </div>
        </Card>
        <Card className="shadow-soft border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertCircle className="w-4 h-4 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">{t("assignments.stats.overdue")}</p><p className="text-xl font-bold">{formatNumber(2)}</p></div>
          </div>
        </Card>
      </section>

      {/* Assignment List */}
      <section className="space-y-3 animate-slide-up" style={{ animationDelay: "200ms" }}>
        {mockAssignments.map((a) => (
          <Card key={a.id} className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{t(`assignments.items.${a.id}.title`)}</h3>
                    <Badge className={`text-xs ${statusColors[a.status]}`}>{t(`assignments.status.${a.status}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("assignments.due", { course: t(`assignments.items.${a.id}.course`), date: formatDate(a.due) })}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-bold"><bdi>{formatNumber(a.submissions)}/{formatNumber(a.total)}</bdi></p>
                    <p className="text-xs text-muted-foreground">{t("assignments.submitted")}</p>
                  </div>
                  <div className="w-32">
                    <Progress value={(a.graded / a.total) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{t("assignments.gradedCount", { count: a.graded })}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorAssignments;
