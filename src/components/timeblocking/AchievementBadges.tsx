import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Trophy, Star, Target, Zap, Flame, Clock, CheckCircle2, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BadgeDefinition {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  requirement: string;
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
  { id: "first-block", icon: CheckCircle2, title: "First Step", description: "Created your first time block", requirement: "1+ block", check: (s) => s.totalBlocks >= 1, tier: "bronze" },
  { id: "planner", icon: Calendar, title: "Day Planner", description: "Scheduled 5+ blocks in a day", requirement: "5 blocks/day", check: (s) => s.todayBlockCount >= 5, tier: "bronze" },
  { id: "streak-3", icon: Flame, title: "On Fire", description: "Maintained a 3-day streak", requirement: "3-day streak", check: (s) => s.streak >= 3, tier: "bronze" },
  { id: "streak-7", icon: Flame, title: "Week Warrior", description: "Maintained a 7-day streak", requirement: "7-day streak", check: (s) => s.streak >= 7, tier: "silver" },
  { id: "streak-14", icon: Trophy, title: "Unstoppable", description: "Maintained a 14-day streak", requirement: "14-day streak", check: (s) => s.streak >= 14, tier: "gold" },
  { id: "streak-30", icon: Trophy, title: "Legend", description: "Maintained a 30-day streak", requirement: "30-day streak", check: (s) => s.streak >= 30, tier: "platinum" },
  { id: "hours-10", icon: Clock, title: "Dedicated", description: "Studied 10+ hours this week", requirement: "10h/week", check: (s) => s.totalWeeklyHours >= 10, tier: "silver" },
  { id: "hours-20", icon: Clock, title: "Scholar", description: "Studied 20+ hours this week", requirement: "20h/week", check: (s) => s.totalWeeklyHours >= 20, tier: "gold" },
  { id: "hours-40", icon: Star, title: "Elite Learner", description: "Studied 40+ hours this week", requirement: "40h/week", check: (s) => s.totalWeeklyHours >= 40, tier: "platinum" },
  { id: "full-day", icon: Target, title: "Perfect Day", description: "Completed all blocks in a day", requirement: "All blocks done", check: (s) => s.todayAllCompleted && s.todayBlockCount >= 3, tier: "gold" },
  { id: "blocks-50", icon: Zap, title: "Power Planner", description: "Created 50+ total blocks", requirement: "50 blocks", check: (s) => s.totalBlocks >= 50, tier: "silver" },
  { id: "blocks-100", icon: Award, title: "Master Scheduler", description: "Created 100+ total blocks", requirement: "100 blocks", check: (s) => s.totalBlocks >= 100, tier: "platinum" },
];

interface AchievementBadgesProps {
  streak: number;
  totalWeeklyHours: number;
  todayBlockCount: number;
  totalBlocks: number;
}

export function AchievementBadges({ streak, totalWeeklyHours, todayBlockCount, totalBlocks }: AchievementBadgesProps) {
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
            Achievements
          </CardTitle>
          <Badge variant="secondary" className="text-[11px]">{earned.length}/{allBadges.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {earned.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Earned</p>
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
                          <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                          <p className="text-[10px] text-muted-foreground">{badge.requirement}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{badge.title}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Locked</p>
            <div className="flex flex-wrap gap-2">
              {locked.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 opacity-50 cursor-default">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold leading-tight text-muted-foreground">{badge.title}</p>
                          <p className="text-[10px] text-muted-foreground/70">{badge.requirement}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{badge.title}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
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
