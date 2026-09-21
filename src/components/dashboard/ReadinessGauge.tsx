import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";

interface ReadinessGaugeProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const ReadinessGauge = ({ 
  percentage, 
  size = "md",
  showLabel = true 
}: ReadinessGaugeProps) => {
  const { t } = useTranslation("dashboard");
  const { formatPercent } = useFormatters();
  const getColor = (value: number) => {
    if (value >= 80) return { stroke: "stroke-success", text: "text-success", bg: "bg-success/10" };
    if (value >= 50) return { stroke: "stroke-warning", text: "text-warning", bg: "bg-warning/10" };
    return { stroke: "stroke-destructive", text: "text-destructive", bg: "bg-destructive/10" };
  };

  const getStatus = (value: number) => {
    if (value >= 80) return t("readiness.ready");
    if (value >= 50) return t("readiness.almost");
    return t("readiness.keepGoing");
  };

  const colors = getColor(percentage);
  
  const sizes = {
    sm: { wrapper: "w-20 h-20", strokeWidth: 6, fontSize: "text-lg" },
    md: { wrapper: "w-32 h-32", strokeWidth: 8, fontSize: "text-2xl" },
    lg: { wrapper: "w-40 h-40", strokeWidth: 10, fontSize: "text-3xl" },
  };

  const { wrapper, strokeWidth, fontSize } = sizes[size];
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", wrapper)}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/50"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={cn(colors.stroke, "transition-all duration-1000 ease-out")}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", fontSize, colors.text)}>
            <bdi>{formatPercent(percentage)}</bdi>
          </span>
        </div>
      </div>
      {showLabel && (
        <div className={cn("px-3 py-1 rounded-full text-sm font-medium", colors.bg, colors.text)}>
          {getStatus(percentage)}
        </div>
      )}
    </div>
  );
};
