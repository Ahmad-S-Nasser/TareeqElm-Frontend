import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Phone, MessageSquare, Coffee, Users, Zap, TrendingUp } from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDate, useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, startOfWeek, addDays } from "date-fns";

const distractionTypes = [
  { value: "phone", icon: Phone, color: "bg-destructive" },
  { value: "messages", icon: MessageSquare, color: "bg-warning" },
  { value: "break", icon: Coffee, color: "bg-accent" },
  { value: "people", icon: Users, color: "bg-primary" },
  { value: "other", icon: Zap, color: "bg-muted-foreground" },
];

interface DistractionDto {
  Id: string;
  SessionId: string | null;
  Type: string;
  Description: string | null;
  DurationSeconds: number;
  LoggedAt: string;
}

interface DistractionTrackerProps {
  sessionId?: string;
}

export function DistractionTracker({ sessionId }: DistractionTrackerProps) {
  const { t, i18n } = useTranslation(["learning", "common"]);
  const { formatNumber } = useFormatters();
  const rtl = i18n.dir() === "rtl";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDistraction, setNewDistraction] = useState({
    type: "phone",
    description: "",
    duration: 5,
  });
  const queryClient = useQueryClient();

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const distractionsQuery = useQuery({
    queryKey: ["distractions", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await api.get<DistractionDto[]>("/distractions", { params: { from: weekStartStr, to: weekEndStr } });
      return data;
    },
  });
  const distractions = useMemo(() => distractionsQuery.data ?? [], [distractionsQuery.data]);

  // Weekly chart computed from the returned list
  const weeklyData = useMemo(() => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const count = distractions.filter((d) => format(new Date(d.LoggedAt), "yyyy-MM-dd") === dateStr).length;
      return { day: formatDate(day, { weekday: "short" }), count };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distractions, weekStart, i18n.language]);

  const logMutation = useMutation({
    mutationFn: async () => (await api.post<DistractionDto>("/distractions", {
      Type: newDistraction.type,
      Description: newDistraction.description || undefined,
      DurationSeconds: newDistraction.duration * 60,
      SessionId: sessionId || undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distractions"] });
      toast.success(t("distraction.logged"));
      setDialogOpen(false);
      setNewDistraction({ type: "phone", description: "", duration: 5 });
    },
    onError: (err) => toast.error(getApiError(err, t("distraction.logFailed"))),
  });

  const logDistraction = () => logMutation.mutate();

  const todayDistractions = distractions.filter((d) => 
    format(new Date(d.LoggedAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
  );

  const totalTimeLost = todayDistractions.reduce((acc, d) => acc + d.DurationSeconds, 0);

  // Calculate most common distraction type
  const typeCounts = todayDistractions.reduce((acc, d) => {
    acc[d.Type] = (acc[d.Type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const topType = sortedTypes[0]?.[0];
  const topTypeInfo = distractionTypes.find((dt) => dt.value === topType);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            {t("distraction.title")}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> {t("distraction.log")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("distraction.logTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t("distraction.type")}</label>
                  <Select value={newDistraction.type} onValueChange={(v) => setNewDistraction({ ...newDistraction, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {distractionTypes.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>
                          <span className="flex items-center gap-2">
                            <dt.icon className="w-4 h-4" />
                            {t(`distraction.types.${dt.value}`)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t("distraction.description")}</label>
                  <Input
                    placeholder={t("distraction.descPlaceholder")}
                    value={newDistraction.description}
                    onChange={(e) => setNewDistraction({ ...newDistraction, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t("distraction.duration")}</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={newDistraction.duration}
                    onChange={(e) => setNewDistraction({ ...newDistraction, duration: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <Button onClick={logDistraction} className="w-full" disabled={logMutation.isPending}>
                  {t("distraction.logButton")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {distractionsQuery.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="flex-1">{getApiError(distractionsQuery.error, t("distraction.loadFailed"))}</span>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => distractionsQuery.refetch()}>{t("common:actions.retry")}</Button>
          </div>
        )}
        {/* Today's Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{formatNumber(todayDistractions.length)}</p>
            <p className="text-[10px] text-muted-foreground">{t("distraction.today")}</p>
          </div>
          <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-center">
            <p className="text-2xl font-bold text-warning-foreground">
              {t("distraction.minutesShort", { value: formatNumber(Math.floor(totalTimeLost / 60)) })}
            </p>
            <p className="text-[10px] text-muted-foreground">{t("distraction.timeLost")}</p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-center">
            {topTypeInfo ? (
              <>
                <topTypeInfo.icon className="w-5 h-5 mx-auto text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground mt-1">{t("distraction.topType")}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-success">✓</p>
                <p className="text-[10px] text-muted-foreground">{t("distraction.focused")}</p>
              </>
            )}
          </div>
        </div>

        {/* Weekly Chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {t("distraction.weekly")}
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barSize={20}>
                <XAxis dataKey="day" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 6 }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "11px",
                    textAlign: rtl ? "right" : "left",
                  }}
                  formatter={(value: number) => [t("distraction.countLabel", { count: value }), t("distraction.count")]}
                />
                <Bar dataKey="count" radius={[4, 4, 2, 2]}>
                  {weeklyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count > 4 ? "hsl(var(--destructive))" : entry.count > 2 ? "hsl(var(--warning))" : "hsl(var(--primary) / 0.5)"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Distractions */}
        {todayDistractions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("distraction.recent")}</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {todayDistractions.slice(0, 5).map((d) => {
                const typeInfo = distractionTypes.find((dt) => dt.value === d.Type);
                return (
                  <div key={d.Id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50">
                    {typeInfo && <typeInfo.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="flex-1 truncate text-xs">
                      {d.Description || (typeInfo ? t(`distraction.types.${typeInfo.value}`) : t("distraction.generic"))}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {t("distraction.minutesShort", { value: formatNumber(Math.round(d.DurationSeconds / 60)) })}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!distractionsQuery.isLoading && !distractionsQuery.isError && todayDistractions.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">{t("distraction.none")}</p>
            <p className="text-xs mt-1">{t("distraction.greatFocus")} 🎯</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
