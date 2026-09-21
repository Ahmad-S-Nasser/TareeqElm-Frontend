import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Trophy, Star, Target, Zap, Flame, Clock, CheckCircle2, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BadgeDefinition {
  id: string;
  icon: React.ElementType;
  check: (stats: BadgeStats) => boolean;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

interface BadgeStats {
  streak: number;
  totalWeeklyHours: number;
  todayBlockCount: number;
  todayAllCompleted: boolean;
  totalBlocks: number;
}

const tierStyles: Record<string, { bg: string; border: string; icon: string; glow: string }> = {
  bronze: { bg: "bg-warning/10", border: "border-warning/30", icon: "text-warning-foreground", glow: "" },
  silver: { bg: "bg-muted", border: "border-border", icon: "text-muted-foreground", glow: "" },
  gold: { bg: "bg-warning/15", border: "border-warning/40", icon: "text-warning", glow: "shadow-[0_0_12px_hsl(var(--warning)/0.2)]" },
  platinum: { bg: "bg-accent/15", border: "border-accent/40", icon: "text-accent", glow: "shadow-[0_0_16px_hsl(var(--accent)/0.25)]" },
};

const allBadges: BadgeDefinition[] = [
  { id: "first-block", icon: CheckCircle2, check: (s) => s.totalBlocks >= 1, tier: "bronze" },
  { id: "planner", icon: Calendar, check: (s) => s.todayBlockCount >= 5, tier: "bronze" },
  { id: "streak-3", icon: Flame, check: (s) => s.streak >= 3, tier: "bronze" },
  { id: "streak-7", icon: Flame, check: (s) => s.streak >= 7, tier: "silver" },
  { id: "streak-14", icon: Trophy, check: (s) => s.streak >= 14, tier: "gold" },
  { id: "streak-30", icon: Trophy, check: (s) => s.streak >= 30, tier: "platinum" },
  { id: "hours-10", icon: Clock, check: (s) => s.totalWeeklyHours >= 10, tier: "silver" },
  { id: "hours-20", icon: Clock, check: (s) => s.totalWeeklyHours >= 20, tier: "gold" },
  { id: "hours-40", icon: Star, check: (s) => s.totalWeeklyHours >= 40, tier: "platinum" },
  { id: "full-day", icon: Target, check: (s) => s.todayAllCompleted && s.todayBlockCount >= 3, tier: "gold" },
  { id: "blocks-50", icon: Zap, check: (s) => s.totalBlocks >= 50, tier: "silver" },
  { id: "blocks-100", icon: Award, check: (s) => s.totalBlocks >= 100, tier: "platinum" },
];

interface AchievementBadgesProps {
  streak: number;
  totalWeeklyHours: number;
  todayBlockCount: number;
  totalBlocks: number;
}

export function AchievementBadges({ streak, totalWeeklyHours, todayBlockCount, totalBlocks }: AchievementBadgesProps) {
  const { t } = useTranslation("learning");
  const { formatNumber } = useFormatters();
  const stats = useMemo<BadgeStats>(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    // Consider "all completed" if it's past 9pm and there are blocks
    const todayAllCompleted = nowMin >= 1260 && todayBlockCount >= 3;
    return { streak, totalWeeklyHours, todayBlockCount, todayAllCompleted, totalBlocks };
  }, [streak, totalWeeklyHours, todayBlockCount, totalBlocks]);

  const earned = useMemo(() => allBadges.filter((b) => b.check(stats)), [stats]);
  const locked = useMemo(() => allBadges.filter((b) => !b.check(stats)), [stats]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-warning" />
            {t("badges.title")}
          </CardTitle>
          <Badge variant="secondary" className="text-[11px]"><bdi>{formatNumber(earned.length)}/{formatNumber(allBadges.length)}</bdi></Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {earned.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-muted-foreground tracking-wider font-medium mb-2">{t("badges.earned")}</p>
            <div className="flex flex-wrap gap-2">
              {earned.map((badge) => {
                const style = tierStyles[badge.tier];
                const Icon = badge.icon;
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.03] cursor-default",
                        style.bg, style.border, style.glow
                      )}>
                        <Icon className={cn("w-4 h-4", style.icon)} />
                        <div>
                          <p className="text-xs font-semibold leading-tight">{t(`badges.items.${badge.id}.title`)}</p>
                          <p className="text-[10px] text-muted-foreground">{t(`badges.items.${badge.id}.req`)}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{t(`badges.items.${badge.id}.title`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`badges.items.${badge.id}.desc`)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground tracking-wider font-medium mb-2">{t("badges.locked")}</p>
            <div className="flex flex-wrap gap-2">
              {locked.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 opacity-50 cursor-default">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold leading-tight text-muted-foreground">{t(`badges.items.${badge.id}.title`)}</p>
                          <p className="text-[10px] text-muted-foreground/70">{t(`badges.items.${badge.id}.req`)}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{t(`badges.items.${badge.id}.title`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`badges.items.${badge.id}.desc`)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
