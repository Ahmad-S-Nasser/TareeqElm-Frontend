import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Sunset, Moon } from "lucide-react";

export type EnergyLevel = "morning" | "afternoon" | "night" | "balanced";

interface EnergyLevelSelectorProps {
  value: EnergyLevel;
  onChange: (level: EnergyLevel) => void;
}

const levels = [
  { id: "morning" as const, icon: Sun, labelKey: "morning", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", activeBg: "bg-warning/20" },
  { id: "afternoon" as const, icon: Sunset, labelKey: "afternoon", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", activeBg: "bg-primary/20" },
  { id: "night" as const, icon: Moon, labelKey: "night", color: "text-accent", bg: "bg-accent/10", border: "border-accent/30", activeBg: "bg-accent/20" },
];

export function EnergyLevelSelector({ value, onChange }: EnergyLevelSelectorProps) {
  const { t } = useTranslation("learning");
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-3">⚡ {t("energy.title")}</p>
        <div className="grid grid-cols-3 gap-2">
          {levels.map((level) => {
            const Icon = level.icon;
            const isActive = value === level.id;
            return (
              <button
                key={level.id}
                onClick={() => onChange(level.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                  isActive
                    ? `${level.activeBg} ${level.border} shadow-sm scale-[1.02]`
                    : "border-border/50 hover:border-border bg-transparent hover:bg-muted/30"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? level.color : "text-muted-foreground")} />
                <span className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>{t(`energy.${level.labelKey}`)}</span>
                <span className="text-[10px] text-muted-foreground">{t(`energy.${level.labelKey}Desc`)}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
