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
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, startOfWeek, addDays } from "date-fns";

const distractionTypes = [
  { value: "phone", label: "Phone/Social Media", icon: Phone, color: "bg-destructive" },
  { value: "messages", label: "Messages/Chat", icon: MessageSquare, color: "bg-warning" },
  { value: "break", label: "Unplanned Break", icon: Coffee, color: "bg-accent" },
  { value: "people", label: "People/Interruption", icon: Users, color: "bg-primary" },
  { value: "other", label: "Other", icon: Zap, color: "bg-muted-foreground" },
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
      return { day: format(day, "EEE"), count };
    });
  }, [distractions, weekStart]);

  const logMutation = useMutation({
    mutationFn: async () => (await api.post<DistractionDto>("/distractions", {
      Type: newDistraction.type,
      Description: newDistraction.description || undefined,
      DurationSeconds: newDistraction.duration * 60,
      SessionId: sessionId || undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distractions"] });
      toast.success("Distraction logged — stay focused! 💪");
      setDialogOpen(false);
      setNewDistraction({ type: "phone", description: "", duration: 5 });
    },
    onError: (err) => toast.error(getApiError(err, "Failed to log distraction")),
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
  const topTypeInfo = distractionTypes.find((t) => t.value === topType);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            Distraction Tracker
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Log
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a Distraction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Type</label>
                  <Select value={newDistraction.type} onValueChange={(v) => setNewDistraction({ ...newDistraction, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {distractionTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <t.icon className="w-4 h-4" />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Description (optional)</label>
                  <Input
                    placeholder="What distracted you?"
                    value={newDistraction.description}
                    onChange={(e) => setNewDistraction({ ...newDistraction, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Duration (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={newDistraction.duration}
                    onChange={(e) => setNewDistraction({ ...newDistraction, duration: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <Button onClick={logDistraction} className="w-full" disabled={logMutation.isPending}>
                  Log Distraction
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
            <span className="flex-1">{getApiError(distractionsQuery.error, "Failed to load distractions")}</span>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => distractionsQuery.refetch()}>Retry</Button>
          </div>
        )}
        {/* Today's Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{todayDistractions.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Today</p>
          </div>
          <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-center">
            <p className="text-2xl font-bold text-warning-foreground">
              {Math.floor(totalTimeLost / 60)}m
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">Time Lost</p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-center">
            {topTypeInfo ? (
              <>
                <topTypeInfo.icon className="w-5 h-5 mx-auto text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase mt-1">Top Type</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-success">✓</p>
                <p className="text-[10px] text-muted-foreground uppercase">Focused!</p>
              </>
            )}
          </div>
        </div>

        {/* Weekly Chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Weekly Distractions
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barSize={20}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 6 }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => [`${value} distractions`, "Count"]}
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
            <p className="text-xs text-muted-foreground mb-2">Recent</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {todayDistractions.slice(0, 5).map((d) => {
                const typeInfo = distractionTypes.find((t) => t.value === d.Type);
                return (
                  <div key={d.Id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50">
                    {typeInfo && <typeInfo.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="flex-1 truncate text-xs">
                      {d.Description || typeInfo?.label || "Distraction"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(d.DurationSeconds / 60)}m
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!distractionsQuery.isLoading && !distractionsQuery.isError && todayDistractions.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No distractions logged today</p>
            <p className="text-xs mt-1">Great focus! Keep it up 🎯</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
