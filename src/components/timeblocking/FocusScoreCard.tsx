import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface FocusScoreCardProps {
  completedPomodoros: number;
  totalStudyMinutes: number;
  totalBlocks: number;
}

export function FocusScoreCard({ completedPomodoros, totalStudyMinutes, totalBlocks }: FocusScoreCardProps) {
  const { t } = useTranslation("learning");
  const { formatNumber } = useFormatters();
  // Focus score: weighted calculation based on pomodoros, study time, and block completion
  const pomodoroScore = Math.min(completedPomodoros * 15, 40); // max 40 from pomodoros
  const timeScore = Math.min(Math.round(totalStudyMinutes / 6), 35); // max 35 from time (3.5h = max)
  const planningScore = Math.min(totalBlocks * 5, 25); // max 25 from planning
  const focusScore = Math.min(pomodoroScore + timeScore + planningScore, 100);

  const getScoreColor = () => {
    if (focusScore >= 80) return "text-success";
    if (focusScore >= 50) return "text-primary";
    if (focusScore >= 25) return "text-warning-foreground";
    return "text-muted-foreground";
  };

  const getScoreLabel = () => {
    if (focusScore >= 80) return t("focusCard.excellent");
    if (focusScore >= 50) return t("focusCard.good");
    if (focusScore >= 25) return t("focusCard.building");
    return t("focusCard.starting");
  };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - focusScore / 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" /> {t("focusCard.title")}
        </p>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity="0.3" />
              <circle
                cx="50" cy="50" r={radius} fill="none"
                stroke={focusScore >= 80 ? "hsl(var(--success))" : focusScore >= 50 ? "hsl(var(--primary))" : "hsl(var(--warning))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-bold", getScoreColor())}>{formatNumber(focusScore)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className={cn("text-sm font-semibold", getScoreColor())}>{getScoreLabel()}</p>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">🍅 {t("focusCard.pomodoros", { count: completedPomodoros })}</p>
              <p className="text-[10px] text-muted-foreground">📖 {t("focusCard.studied", { count: Math.round(totalStudyMinutes) })}</p>
              <p className="text-[10px] text-muted-foreground">📋 {t("focusCard.planned", { count: totalBlocks })}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
