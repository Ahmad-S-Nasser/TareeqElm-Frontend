import { CalendarDays, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/lib/format";

interface ExamCountdownProps {
  examName: string;
  date: Date;
  onStartPractice?: () => void;
}

export const ExamCountdown = ({ examName, date, onStartPractice }: ExamCountdownProps) => {
  const { t } = useTranslation("dashboard");
  const { formatDate, formatNumber } = useFormatters();
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const remainingDays = diffDays % 7;

  const getUrgencyStyle = () => {
    if (diffDays <= 7) return "border-destructive/30 bg-destructive/5";
    if (diffDays <= 14) return "border-warning/30 bg-warning/5";
    return "border-primary/30 bg-primary/5";
  };

  const getUrgencyText = () => {
    if (diffDays <= 7) return "text-destructive";
    if (diffDays <= 14) return "text-warning";
    return "text-primary";
  };

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${getUrgencyStyle()}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <CalendarDays className="w-4 h-4" />
            <span>{t("exam.upcoming")}</span>
          </div>
          <h3 className="font-semibold text-lg">{examName}</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card text-sm font-medium ${getUrgencyText()}`}>
          <Clock className="w-4 h-4" />
          {t("exam.daysLeft", { count: diffDays })}
        </div>
      </div>

      {/* Countdown Display */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 text-center p-3 rounded-xl bg-card">
          <div className={`text-2xl font-bold ${getUrgencyText()}`}>{formatNumber(diffWeeks)}</div>
          <div className="text-xs text-muted-foreground">{t("exam.weeks")}</div>
        </div>
        <div className="flex-1 text-center p-3 rounded-xl bg-card">
          <div className={`text-2xl font-bold ${getUrgencyText()}`}>{formatNumber(remainingDays)}</div>
          <div className="text-xs text-muted-foreground">{t("exam.daysLabel")}</div>
        </div>
        <div className="flex-1 text-center p-3 rounded-xl bg-card">
          <div className="text-2xl font-bold text-muted-foreground">
            {formatDate(date, { month: 'short', day: 'numeric' })}
          </div>
          <div className="text-xs text-muted-foreground">{t("exam.date")}</div>
        </div>
      </div>

      <Button 
        onClick={onStartPractice} 
        className="w-full"
        variant={diffDays <= 7 ? "destructive" : "default"}
      >
        {t("exam.startPractice")}
      </Button>
    </div>
  );
};
