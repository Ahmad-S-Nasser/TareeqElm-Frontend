import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Lightbulb, Target, Flame, RotateCcw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyCoach } from "@/hooks/useStudyCoach";

export const StudyCoachWidget = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { trainerData, dataLoading } = useStudyCoach();

  const alerts: { icon: React.ElementType; text: string; color: string }[] = [];

  if (trainerData) {
    if (trainerData.FlashcardsDue > 0) {
      alerts.push({ icon: RotateCcw, text: t("coachWidget.flashcardsDue", { count: trainerData.FlashcardsDue }), color: "text-rose-500" });
    }
    if (trainerData.Streak > 0) {
      alerts.push({ icon: Flame, text: t("coachWidget.streak", { count: trainerData.Streak }), color: "text-orange-500" });
    }
    if (trainerData.WeakTopics && trainerData.WeakTopics.length > 0) {
      alerts.push({ icon: Target, text: t("coachWidget.focusOn", { topic: trainerData.WeakTopics[0] }), color: "text-amber-500" });
    }
    if (alerts.length === 0) {
      alerts.push({ icon: Lightbulb, text: t("coachWidget.startSession"), color: "text-primary" });
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          {t("coachWidget.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dataLoading ? (
          <p className="text-sm text-muted-foreground">{t("coachWidget.analyzing")}</p>
        ) : (
          <>
            {alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className="flex items-start gap-2">
                <alert.icon className={cn("w-4 h-4 mt-0.5 shrink-0", alert.color)} />
                <p className="text-sm text-muted-foreground">{alert.text}</p>
              </div>
            ))}
          </>
        )}
        <Button
          size="sm"
          className="w-full mt-2 gap-2"
          onClick={() => navigate("/ai-coach")}
        >
          {t("coachWidget.open")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Button>
      </CardContent>
    </Card>
  );
};
