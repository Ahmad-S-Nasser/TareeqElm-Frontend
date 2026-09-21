import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { FileSearch, Brain, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ParsingStep {
  id: string;
  icon: React.ElementType;
  status: "pending" | "active" | "complete";
}

interface ParsingProgressProps {
  isActive: boolean;
  onComplete?: () => void;
}

export const ParsingProgress = ({ isActive, onComplete }: ParsingProgressProps) => {
  const { t } = useTranslation("instructor");
  const { formatPercent, formatNumber } = useFormatters();
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ParsingStep[]>([
    { id: "upload", icon: FileSearch, status: "pending" },
    { id: "parse", icon: FileSearch, status: "pending" },
    { id: "analyze", icon: Brain, status: "pending" },
    { id: "generate", icon: Sparkles, status: "pending" },
  ]);

  const totalSteps = steps.length;

  useEffect(() => {
    if (!isActive) return;

    const stepDuration = 1500; // ms per step
    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < totalSteps) {
        setSteps(prev => prev.map((step, idx) => ({
          ...step,
          status: idx < currentStep ? "complete" : idx === currentStep ? "active" : "pending"
        })));
        setProgress(((currentStep + 1) / totalSteps) * 100);
        currentStep++;
      } else {
        clearInterval(interval);
        setSteps(prev => prev.map(step => ({ ...step, status: "complete" })));
        setProgress(100);
        setTimeout(() => onComplete?.(), 500);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isActive, onComplete, totalSteps]);

  if (!isActive && progress === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-card p-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
          <Sparkles className="w-5 h-5 text-accent-foreground animate-pulse" />
        </div>
        <div>
          <h3 className="font-semibold">{t("syllabus.parsing.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("syllabus.parsing.analyzing")}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">{t("syllabus.parsing.progress")}</span>
          <span className="font-medium">{formatPercent(Math.round(progress))}</span>
        </div>
        <div className="relative">
          <Progress value={progress} className="h-3" />
          {/* Shimmer effect */}
          <div 
            className="absolute inset-0 h-3 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            style={{ backgroundSize: "200% 100%" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div 
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                step.status === "active" && "bg-accent/10",
                step.status === "complete" && "bg-success/5"
              )}
            >
              {/* Step Icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                step.status === "pending" && "bg-muted text-muted-foreground",
                step.status === "active" && "bg-accent text-accent-foreground",
                step.status === "complete" && "bg-success text-success-foreground"
              )}>
                {step.status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : step.status === "complete" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              {/* Step Label */}
              <span className={cn(
                "text-sm font-medium transition-colors",
                step.status === "pending" && "text-muted-foreground",
                step.status === "active" && "text-accent",
                step.status === "complete" && "text-success"
              )}>
                {t(`syllabus.parsing.steps.${step.id}`)}
              </span>

              {/* Step Number */}
              <span className="ms-auto text-xs text-muted-foreground">
                {t("syllabus.parsing.stepOf", { current: formatNumber(index + 1), total: formatNumber(steps.length) })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
