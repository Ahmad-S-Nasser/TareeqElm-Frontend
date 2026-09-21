import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MemoryStrengthBadgeProps {
  repetitions: number;
  easeFactor: number;
}

export function MemoryStrengthBadge({ repetitions, easeFactor }: MemoryStrengthBadgeProps) {
  const { t } = useTranslation("learning");
  const getStrength = () => {
    if (repetitions >= 4 && easeFactor >= 2.3) return { label: t("spaced.strength.strong"), color: "bg-success/15 text-success border-success/30" };
    if (repetitions >= 2 || (repetitions >= 1 && easeFactor >= 2.0)) return { label: t("spaced.strength.medium"), color: "bg-warning/15 text-warning-foreground border-warning/30" };
    return { label: t("spaced.strength.weak"), color: "bg-destructive/15 text-destructive border-destructive/30" };
  };

  const strength = getStrength();

  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", strength.color)}>
      {strength.label}
    </Badge>
  );
}
