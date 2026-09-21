import { Check, Circle, Sparkles, BookOpen, Brain, FileQuestion } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PlanItem {
  id: string;
  /** Translation key inside the dashboard namespace (or a custom title). */
  title: string;
  type: "lesson" | "flashcard" | "quiz" | "ai-review";
  /** Duration in minutes. */
  minutes: number;
  completed: boolean;
}

interface TodaysPlanProps {
  items: PlanItem[];
  onToggleComplete?: (id: string) => void;
}

export const TodaysPlan = ({ items, onToggleComplete }: TodaysPlanProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { formatPercent, formatNumber, formatDuration } = useFormatters();
  const completedCount = items.filter(item => item.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  const getIcon = (type: PlanItem["type"]) => {
    switch (type) {
      case "lesson": return BookOpen;
      case "flashcard": return Brain;
      case "quiz": return FileQuestion;
      case "ai-review": return Sparkles;
    }
  };

  const getTypeStyle = (type: PlanItem["type"]) => {
    switch (type) {
      case "lesson": return "bg-primary/10 text-primary";
      case "flashcard": return "bg-warning/10 text-warning";
      case "quiz": return "bg-success/10 text-success";
      case "ai-review": return "bg-accent/10 text-accent";
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{t("plan.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("plan.completed", { done: formatNumber(completedCount), total: formatNumber(items.length) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{formatPercent(progress)}</span>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const Icon = getIcon(item.type);
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group",
                item.completed 
                  ? "bg-muted/50 opacity-60" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => {
                const routes: Record<string, string> = {
                  lesson: "/courses",
                  flashcard: "/flashcards",
                  quiz: "/mock-exam",
                  "ai-review": "/ai-tutor",
                };
                navigate(routes[item.type]);
              }}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Checkbox */}
              <div 
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                  item.completed
                    ? "bg-success border-success"
                    : "border-muted-foreground/30 group-hover:border-primary"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete?.(item.id);
                }}
              >
                {item.completed ? (
                  <Check className="w-3.5 h-3.5 text-success-foreground" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-transparent" />
                )}
              </div>

              {/* Icon */}
              <div className={cn("p-2 rounded-lg", getTypeStyle(item.type))}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  item.completed && "line-through"
                )}>
                  {t(item.title, { defaultValue: item.title })}
                </p>
              </div>

              {/* Duration */}
              <span className="text-xs text-muted-foreground">{formatDuration(item.minutes * 60)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
