import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "accent";
  onClick?: () => void;
}

export const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
}: StatsCardProps) => {
  const { formatNumber } = useFormatters();
  const variants = {
    default: {
      bg: "bg-card",
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
    },
    primary: {
      bg: "bg-primary/5 border-primary/20",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    success: {
      bg: "bg-success/5 border-success/20",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    warning: {
      bg: "bg-warning/5 border-warning/20",
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
    accent: {
      bg: "bg-accent/5 border-accent/20",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
  };

  const styles = variants[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border/50 shadow-card p-5 transition-all",
        onClick ? "cursor-pointer hover:shadow-elevated hover:scale-[1.02] active:scale-[0.98]" : "hover:shadow-soft",
        styles.bg
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl", styles.iconBg)}>
          <Icon className={cn("w-5 h-5", styles.iconColor)} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend.positive
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          )}>
            <span dir="ltr">{trend.positive ? "+" : ""}{formatNumber(trend.value)}%</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
