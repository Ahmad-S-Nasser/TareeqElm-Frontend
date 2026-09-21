import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { formatDate, useFormatters } from "@/lib/format";

interface StudyHeatmapProps {
  data: { date: string; value: number }[];
  className?: string;
}

const CELL_SIZE = 10;
const CELL_GAP = 2;
const WEEKS_TO_SHOW = 52;

export function StudyHeatmap({ data, className }: StudyHeatmapProps) {
  const { t } = useTranslation("learning");
  const { formatNumber } = useFormatters();
  const today = new Date();
  const startDate = startOfWeek(subDays(today, WEEKS_TO_SHOW * 7), { weekStartsOn: 0 });
  
  // Create a map for quick lookup
  const dataMap = new Map(data.map(d => [d.date, d.value]));
  
  // Generate weeks
  const weeks: { date: Date; value: number }[][] = [];
  let currentDate = startDate;
  
  for (let w = 0; w < WEEKS_TO_SHOW; w++) {
    const week: { date: Date; value: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      week.push({
        date: currentDate,
        value: dataMap.get(dateStr) || 0,
      });
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }
  
  const getColorClass = (value: number): string => {
    if (value === 0) return "bg-muted/50";
    if (value === 1) return "bg-primary/20";
    if (value === 2) return "bg-primary/40";
    if (value === 3) return "bg-primary/60";
    return "bg-primary";
  };
  
  // 2024-01-07 is a Sunday: label the rows with the active language's short weekday names.
  const dayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => formatDate(new Date(2024, 0, 7 + i), { weekday: "short" }));
  const monthLabels: { label: string; week: number }[] = [];
  
  // Calculate month labels
  weeks.forEach((week, weekIndex) => {
    const firstDayOfWeek = week[0].date;
    if (firstDayOfWeek.getDate() <= 7) {
      monthLabels.push({
        label: formatDate(firstDayOfWeek, { month: "short" }),
        week: weekIndex,
      });
    }
  });
  
  return (
    <div dir="ltr" className={cn("flex flex-col gap-2", className)}>
      {/* Month labels */}
      <div className="flex ps-8">
        <div className="flex" style={{ gap: CELL_GAP }}>
          {weeks.map((_, weekIndex) => {
            const monthLabel = monthLabels.find(m => m.week === weekIndex);
            return (
              <div
                key={weekIndex}
                style={{ width: CELL_SIZE }}
                className="text-[9px] text-muted-foreground"
              >
                {monthLabel?.label || ""}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col justify-between pe-2" style={{ height: 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP }}>
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <span key={dayIndex} className="text-[9px] text-muted-foreground leading-none h-[10px] flex items-center">
              {dayIndex % 2 === 1 ? dayLabels[dayIndex] : ""}
            </span>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <div className="flex" style={{ gap: CELL_GAP }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col" style={{ gap: CELL_GAP }}>
              {week.map((day, dayIndex) => (
                <Tooltip key={`${weekIndex}-${dayIndex}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "rounded-[2px] transition-all hover:ring-1 hover:ring-primary/50 cursor-default",
                        getColorClass(day.value)
                      )}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p className="font-medium">{formatDate(day.date, { month: "short", day: "numeric", year: "numeric" })}</p>
                    <p className="text-muted-foreground">
                      {day.value === 0 ? t("heatmap.noActivity") : t("heatmap.sessions", { count: day.value })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-2 ps-8 mt-1">
        <span className="text-[10px] text-muted-foreground">{t("heatmap.less")}</span>
        <div className="flex gap-[2px]">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("rounded-[2px]", getColorClass(level))}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{t("heatmap.more")}</span>
      </div>
    </div>
  );
}
