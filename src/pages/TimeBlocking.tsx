import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { AlertCircle, Plus, Trash2, Clock, CalendarDays, Loader2, ChevronLeft, ChevronRight, LayoutGrid, Calendar, Copy, GripVertical, Flame, BarChart3, Bell, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation, Trans } from "react-i18next";
import i18n from "@/i18n";
import { formatDate, useFormatters } from "@/lib/format";
import api, { getApiError } from "@/lib/api";
import { PomodoroTimer } from "@/components/timeblocking/PomodoroTimer";
import { AchievementBadges } from "@/components/timeblocking/AchievementBadges";
import { EnergyLevelSelector, type EnergyLevel } from "@/components/timeblocking/EnergyLevelSelector";
import { FocusScoreCard } from "@/components/timeblocking/FocusScoreCard";
import { DistractionTracker } from "@/components/timeblocking/DistractionTracker";
import { format, addDays, startOfWeek, isToday, isSameDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

type BlockCategory = "study" | "break" | "review" | "practice" | "personal";

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: BlockCategory;
  date: string;
}

interface TimeBlockDto {
  Id: string;
  Title: string;
  Category: BlockCategory;
  Date: string;
  StartTime: string;
  EndTime: string;
}

interface EnrollmentDto {
  CourseTitle?: string | null;
  Course?: { Title?: string } | null;
}

const toBlock = (d: TimeBlockDto): TimeBlock => ({
  id: d.Id,
  title: d.Title,
  startTime: d.StartTime.slice(0, 5),
  endTime: d.EndTime.slice(0, 5),
  category: d.Category,
  date: d.Date.slice(0, 10),
});

const sortBlocks = (list: TimeBlock[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

const categoryConfig: Record<BlockCategory, { bg: string; border: string; text: string; dot: string }> = {
  study: { bg: "bg-primary/10", border: "border-primary/25", text: "text-primary", dot: "bg-primary" },
  break: { bg: "bg-success/10", border: "border-success/25", text: "text-success", dot: "bg-success" },
  review: { bg: "bg-accent/10", border: "border-accent/25", text: "text-accent", dot: "bg-accent" },
  practice: { bg: "bg-warning/10", border: "border-warning/25", text: "text-warning-foreground", dot: "bg-warning" },
  personal: { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const hours = Array.from({ length: 16 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

const TimeBlocking = () => {
  const { t, i18n: i18nInstance } = useTranslation(["learning", "common"]);
  const { formatNumber, formatPercent, formatDuration } = useFormatters();
  const rtl = i18nInstance.dir() === "rtl";
  const shortDate = (d: Date) => formatDate(d, { month: "short", day: "numeric" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState<Date | undefined>(undefined);
  const [activeBlock, setActiveBlock] = useState<TimeBlock | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [newBlock, setNewBlock] = useState({ title: "", startTime: "08:00", endTime: "09:00", category: "study" as BlockCategory });
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("morning");
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const queryClient = useQueryClient();

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const blocksQuery = useQuery({
    queryKey: ["timeblocks", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await api.get<TimeBlockDto[]>("/TimeBlocks", { params: { from: weekStartStr, to: weekEndStr } });
      return sortBlocks(data.map(toBlock));
    },
  });
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const loading = blocksQuery.isLoading;

  const streakQuery = useQuery({
    queryKey: ["timeblocks-streak"],
    queryFn: async () => (await api.get<{ Streak: number }>("/TimeBlocks/streak")).data.Streak,
  });
  const streak = streakQuery.data ?? 0;

  const coursesQuery = useQuery({
    queryKey: ["enrollments-me"],
    queryFn: async () => (await api.get<EnrollmentDto[]>("/Enrollments/me")).data,
  });

  const invalidateBlocks = () => {
    queryClient.invalidateQueries({ queryKey: ["timeblocks"] });
    queryClient.invalidateQueries({ queryKey: ["timeblocks-streak"] });
  };

  const blocksForDate = useCallback((dateStr: string) => blocks.filter((b) => b.date === dateStr), [blocks]);
  const todayBlocks = blocksForDate(selectedDateStr);

  const addMutation = useMutation({
    mutationFn: async () => (await api.post<TimeBlockDto>("/TimeBlocks", {
      Title: newBlock.title, Category: newBlock.category, Date: selectedDateStr, StartTime: newBlock.startTime, EndTime: newBlock.endTime,
    })).data,
    onSuccess: () => {
      invalidateBlocks();
      setNewBlock({ title: "", startTime: "08:00", endTime: "09:00", category: "study" });
      setDialogOpen(false);
      toast.success(t("blocking.toast.added"));
    },
    onError: (err) => toast.error(getApiError(err, t("blocking.toast.saveFailed"))),
  });

  const addBlock = () => {
    if (!newBlock.title || !newBlock.startTime || !newBlock.endTime) { toast.error(t("blocking.toast.fillAll")); return; }
    if (newBlock.endTime <= newBlock.startTime) { toast.error(t("blocking.toast.endAfterStart")); return; }
    addMutation.mutate();
  };

  const removeMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/TimeBlocks/${id}`); },
    onSuccess: () => { invalidateBlocks(); toast.success(t("blocking.toast.removed")); },
    onError: (err) => toast.error(getApiError(err, t("blocking.toast.removeFailed"))),
  });
  const removeBlock = (id: string) => removeMutation.mutate(id);

  const copyMutation = useMutation({
    mutationFn: async (targetStr: string) => (await api.post<TimeBlockDto[]>("/TimeBlocks/copy", { SourceDate: selectedDateStr, TargetDate: targetStr })).data,
    onSuccess: (copied) => {
      invalidateBlocks();
      toast.success(copyTargetDate ? t("blocking.toast.copiedTo", { count: copied.length, date: shortDate(copyTargetDate) }) : t("blocking.toast.copied", { count: copied.length }));
      setCopyDialogOpen(false);
      setCopyTargetDate(undefined);
    },
    onError: (err) => toast.error(getApiError(err, t("blocking.toast.copyFailed"))),
  });

  const duplicateDay = () => {
    if (!copyTargetDate) { toast.error(t("blocking.toast.selectTarget")); return; }
    const targetStr = format(copyTargetDate, "yyyy-MM-dd");
    if (targetStr === selectedDateStr) { toast.error(t("blocking.toast.differentDate")); return; }
    if (todayBlocks.length === 0) { toast.error(t("blocking.toast.nothingToCopy")); return; }
    copyMutation.mutate(targetStr);
  };

  // Schedule generator (the server replaces the selected day's blocks)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const courses = (coursesQuery.data ?? []).map((e) => e.CourseTitle ?? e.Course?.Title).filter((title): title is string => !!title);
      return (await api.post<TimeBlockDto[]>("/TimeBlocks/generate", { Date: selectedDateStr, EnergyLevel: energyLevel, Courses: courses })).data;
    },
    onSuccess: (created) => {
      invalidateBlocks();
      if (created.length === 0) toast.info(t("blocking.toast.noneGenerated"));
      else toast.success(t("blocking.toast.generated", { count: created.length, date: shortDate(selectedDate) }));
    },
    onError: (err) => toast.error(getApiError(err, t("blocking.toast.generateFailed"))),
  });
  const isGenerating = generateMutation.isPending;
  const generateAISchedule = () => generateMutation.mutate();

  const handleDragStart = (blockId: string) => setDraggedBlockId(blockId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetBlockId: string) => {
    if (!draggedBlockId || draggedBlockId === targetBlockId) { setDraggedBlockId(null); return; }
    const draggedBlock = blocks.find((b) => b.id === draggedBlockId);
    const targetBlock = blocks.find((b) => b.id === targetBlockId);
    setDraggedBlockId(null);
    if (!draggedBlock || !targetBlock) return;
    try {
      await Promise.all([
        api.put(`/TimeBlocks/${draggedBlock.id}`, { StartTime: targetBlock.startTime, EndTime: targetBlock.endTime }),
        api.put(`/TimeBlocks/${targetBlock.id}`, { StartTime: draggedBlock.startTime, EndTime: draggedBlock.endTime }),
      ]);
      toast.success(t("blocking.toast.swapped"));
    } catch (err) {
      toast.error(getApiError(err, t("blocking.toast.swapFailed")));
    } finally {
      invalidateBlocks();
    }
  };

  // Detect current active block
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const active = blocks.find((b) => {
        if (b.date !== todayStr || b.category === "break" || b.category === "personal") return false;
        const [sh, sm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        return nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
      });
      setActiveBlock(active || null);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [blocks]);

  const getMinutes = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  const totalStudyMinutes = useMemo(() =>
    todayBlocks.filter((b) => b.category !== "break" && b.category !== "personal")
      .reduce((acc, b) => acc + getMinutes(b.startTime, b.endTime), 0), [todayBlocks]);

  const weeklyChartData = useMemo(() => {
    return weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayBlocks = blocks.filter((b) => b.date === dateStr);
      const studyMins = dayBlocks
        .filter((b) => b.category !== "break" && b.category !== "personal")
        .reduce((acc, b) => acc + getMinutes(b.startTime, b.endTime), 0);
      return { day: formatDate(day, { weekday: "short" }), date: dateStr, hours: Math.round((studyMins / 60) * 10) / 10, isToday: isToday(day) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, blocks, i18nInstance.language]);

  // Notification reminders
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current || loading) return;
    notifiedRef.current = true;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayStr = format(now, "yyyy-MM-dd");
    const todayBlocksList = blocks.filter((b) => b.date === todayStr);
    if (nowMin < 600 && todayBlocksList.length === 0) {
      setTimeout(() => toast(t("blocking.reminders.noBlocks"), { description: t("blocking.reminders.noBlocksDesc"), duration: 6000 }), 1500);
    }
    const upcoming = todayBlocksList.find((b) => {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const blockMin = sh * 60 + sm;
      return blockMin > nowMin && blockMin - nowMin <= 15;
    });
    if (upcoming) {
      setTimeout(() => toast(t("blocking.reminders.startsSoon", { title: upcoming.title }), { description: `${upcoming.startTime} – ${upcoming.endTime}`, duration: 8000 }), 2000);
    }
    if (nowMin >= 1080 && todayBlocksList.length === 0 && streak > 0) {
      setTimeout(() => toast(t("blocking.reminders.streakRisk"), { description: t("blocking.reminders.streakRiskDesc", { count: streak }), duration: 8000 }), 2500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, loading, streak]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />} />

      <main className={cn("pt-20 pb-10 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        <div className="max-w-7xl mx-auto space-y-6">
          {blocksQuery.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="flex-1">{getApiError(blocksQuery.error, t("blocking.loadFailed"))}</span>
              <Button size="sm" variant="outline" onClick={() => blocksQuery.refetch()}>{t("common:actions.retry")}</Button>
            </div>
          )}
          {/* Hero Header */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-primary/10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/15">
                    <CalendarDays className="w-6 h-6 text-primary" />
                  </div>
                  {t("blocking.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-2 max-w-md">{t("blocking.subtitle")}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
                  <TabsList className="h-9">
                    <TabsTrigger value="day" className="gap-1.5 text-xs px-3"><Calendar className="w-3.5 h-3.5" />{t("blocking.day")}</TabsTrigger>
                    <TabsTrigger value="week" className="gap-1.5 text-xs px-3"><LayoutGrid className="w-3.5 h-3.5" />{t("blocking.week")}</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* AI Generate Button */}
                <Button
                  variant="outline"
                  className="gap-2 border-accent/30 text-accent hover:bg-accent/10"
                  onClick={generateAISchedule}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isGenerating ? t("blocking.generating") : t("blocking.aiSchedule")}
                </Button>

                {/* Copy Day Dialog */}
                <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" disabled={todayBlocks.length === 0}>
                      <Copy className="w-4 h-4" /> {t("blocking.copyDay")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("blocking.copyTitle")}</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      <Trans i18nKey="blocking.copyDesc" ns="learning" values={{ count: todayBlocks.length, date: shortDate(selectedDate) }} components={{ b: <strong /> }} />
                    </p>
                    <div className="flex justify-center pt-2">
                      <CalendarWidget mode="single" selected={copyTargetDate} onSelect={setCopyTargetDate} disabled={(date) => isSameDay(date, selectedDate)} className="p-3 pointer-events-auto" />
                    </div>
                    {copyTargetDate && (
                      <p className="text-sm text-center text-muted-foreground">
                        <Trans i18nKey="blocking.target" ns="learning" values={{ date: formatDate(copyTargetDate, { weekday: "long", month: "short", day: "numeric" }) }} components={{ b: <strong className="text-foreground" /> }} />
                      </p>
                    )}
                    <Button onClick={duplicateDay} className="w-full" disabled={!copyTargetDate}>
                      {t("blocking.copyBlocks", { count: todayBlocks.length })}
                    </Button>
                  </DialogContent>
                </Dialog>

                {/* Add Block Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-md"><Plus className="w-4 h-4" /> {t("blocking.addBlock")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("blocking.addTitle")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <Input placeholder={t("blocking.blockTitle")} value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })} />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">{t("blocking.start")}</label>
                          <Input type="time" dir="ltr" value={newBlock.startTime} onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">{t("blocking.end")}</label>
                          <Input type="time" dir="ltr" value={newBlock.endTime} onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })} />
                        </div>
                      </div>
                      <Select value={newBlock.category} onValueChange={(v) => setNewBlock({ ...newBlock, category: v as BlockCategory })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryConfig).map(([k, c]) => (
                            <SelectItem key={k} value={k}>
                              <span className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", c.dot)} />{t(`blocking.category.${k}`)}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={addBlock} className="w-full">{t("blocking.addBlock")}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, viewMode === "week" ? -7 : -1))}>
              <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {viewMode === "day"
                  ? formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                  : `${shortDate(weekStart)} – ${formatDate(addDays(weekStart, 6), { month: "short", day: "numeric", year: "numeric" })}`}
              </p>
              {!isToday(selectedDate) && viewMode === "day" && (
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-primary hover:underline mt-0.5">{t("blocking.goToToday")}</button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, viewMode === "week" ? 7 : 1))}>
              <ChevronRight className="w-5 h-5 rtl:rotate-180" />
            </Button>
          </div>

          {/* Stats Row + Energy + Pomodoro + Focus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: t("blocking.stats.totalBlocks"), value: formatNumber(todayBlocks.length), color: "text-foreground" },
                  { label: t("blocking.stats.studyTime"), value: formatDuration(totalStudyMinutes * 60), color: "text-primary" },
                  { label: t("blocking.stats.breaks"), value: formatNumber(todayBlocks.filter((b) => b.category === "break").length), color: "text-success" },
                  { label: t("blocking.stats.focusRatio"), value: todayBlocks.length > 0 ? formatPercent((todayBlocks.filter((b) => b.category === "study" || b.category === "practice").length / todayBlocks.length) * 100) : formatPercent(0), color: "text-accent" },
                ].map((stat) => (
                  <Card key={stat.label} className="overflow-hidden">
                    <CardContent className="p-4 text-center">
                      <p className="text-[11px] text-muted-foreground tracking-wider font-medium">{stat.label}</p>
                      <p className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
                {/* Streak Card */}
                <Card className={cn("overflow-hidden border", streak >= 7 ? "border-warning/40 bg-gradient-to-br from-warning/10 to-warning/5" : streak >= 3 ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" : "")}>
                  <CardContent className="p-4 text-center">
                    <Flame className={cn("w-5 h-5 mx-auto mb-0.5", streak >= 7 ? "text-warning" : streak >= 3 ? "text-primary" : "text-muted-foreground")} />
                    <p className="text-[11px] text-muted-foreground tracking-wider font-medium">{t("blocking.stats.streak")}</p>
                    <p className={cn("text-2xl font-bold mt-0.5", streak >= 7 ? "text-warning-foreground" : streak >= 3 ? "text-primary" : "text-foreground")}>
                      {t("blocking.days", { count: streak })}
                    </p>
                    {streak >= 3 && <p className="text-[10px] text-muted-foreground mt-0.5">🔥 {t("blocking.keepGoing")}</p>}
                  </CardContent>
                </Card>
              </div>
              {/* Energy Level Selector */}
              <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
            </div>
            <div className="space-y-4">
              <PomodoroTimer activeBlockTitle={activeBlock?.title || null} onSessionComplete={() => setCompletedPomodoros(p => p + 1)} />
              <FocusScoreCard completedPomodoros={completedPomodoros} totalStudyMinutes={totalStudyMinutes} totalBlocks={todayBlocks.length} />
              <DistractionTracker />
            </div>
          </div>

          {/* Category Legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(categoryConfig).map(([key, c]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("w-2.5 h-2.5 rounded-full", c.dot)} />
                {t(`blocking.category.${key}`)}
              </div>
            ))}
          </div>

          {/* Weekly Study Hours Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                {t("blocking.weeklyHours")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData} barSize={32}>
                    <XAxis dataKey="day" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis orientation={rtl ? "right" : "left"} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => t("blocking.hoursShort", { value: formatNumber(v) })} width={40} />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 8 }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                        textAlign: rtl ? "right" : "left",
                      }}
                      formatter={(value: number) => [t("blocking.hoursShort", { value: formatNumber(value) }), t("blocking.stats.studyTime")]}
                    />
                    <Bar dataKey="hours" radius={[8, 8, 4, 4]}>
                      {weeklyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isToday ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                {t("blocking.weekTotal", { value: formatNumber(weeklyChartData.reduce((s, d) => s + d.hours, 0), { maximumFractionDigits: 1 }) })}
              </p>
            </CardContent>
          </Card>

          {viewMode === "day" && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {isToday(selectedDate) ? t("blocking.todaySchedule") : t("blocking.daySchedule", { day: formatDate(selectedDate, { weekday: "long" }) })}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">{t("blocking.dragHint")}</p>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {todayBlocks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center pb-4">{t("blocking.emptyDay")}</p>
                )}
                <DayTimeline
                  blocks={todayBlocks}
                  activeBlock={activeBlock}
                  onRemove={removeBlock}
                  draggedBlockId={draggedBlockId}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </CardContent>
            </Card>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                  {t("blocking.weeklyOverview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayBlocks = blocksForDate(dateStr);
                    const isSel = isSameDay(day, selectedDate);
                    return (
                      <button
                        key={dateStr}
                        onClick={() => { setSelectedDate(day); setViewMode("day"); }}
                        className={cn(
                          "rounded-xl border p-3 text-start transition-all hover:shadow-md min-h-[200px] flex flex-col",
                          isSel ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 hover:border-primary/20",
                          isToday(day) && "ring-1 ring-primary/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{formatDate(day, { weekday: "short" })}</span>
                          <span className={cn("text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full", isToday(day) ? "bg-primary text-primary-foreground" : "")}>
                            {formatNumber(day.getDate())}
                          </span>
                        </div>
                        <div className="flex-1 space-y-1">
                          {dayBlocks.slice(0, 5).map((block) => (
                            <div key={block.id} className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium truncate border", categoryConfig[block.category].bg, categoryConfig[block.category].border, categoryConfig[block.category].text)}>
                              {block.title}
                            </div>
                          ))}
                          {dayBlocks.length > 5 && <p className="text-[10px] text-muted-foreground">{t("blocking.more", { count: dayBlocks.length - 5 })}</p>}
                          {dayBlocks.length === 0 && <p className="text-[10px] text-muted-foreground/50 mt-4 text-center">{t("blocking.noBlocks")}</p>}
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <p className="text-[10px] text-muted-foreground">{t("blocking.blocksCount", { count: dayBlocks.length })}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Achievement Badges */}
          <AchievementBadges
            streak={streak}
            totalWeeklyHours={weeklyChartData.reduce((s, d) => s + d.hours, 0)}
            todayBlockCount={todayBlocks.length}
            totalBlocks={blocks.length}
          />

          {/* Tips */}
          <Card className="border-primary/15 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">💡 {t("blocking.tips.title")}</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• <Trans i18nKey="blocking.tips.ai" ns="learning" components={{ b: <strong /> }} /></li>
                <li>• <Trans i18nKey="blocking.tips.energy" ns="learning" components={{ b: <strong /> }} /></li>
                <li>• <Trans i18nKey="blocking.tips.breaks" ns="learning" components={{ b: <strong /> }} /></li>
                <li>• <Trans i18nKey="blocking.tips.focus" ns="learning" components={{ b: <strong /> }} /></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// --- Day Timeline Component with Drag & Drop ---
interface DayTimelineProps {
  blocks: TimeBlock[];
  activeBlock: TimeBlock | null;
  onRemove: (id: string) => void;
  draggedBlockId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string) => void;
}

function DayTimeline({ blocks, activeBlock, onRemove, draggedBlockId, onDragStart, onDragOver, onDrop }: DayTimelineProps) {
  const { t } = useTranslation("learning");
  const getBlockHeight = (b: TimeBlock) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    return Math.max((eh * 60 + em - (sh * 60 + sm)) * 1.2, 40);
  };
  const getBlockTop = (b: TimeBlock) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    return (sh - 6) * 72 + sm * 1.2;
  };

  return (
    <div className="relative" style={{ height: `${16 * 72}px` }}>
      {hours.map((hour, i) => (
        <div key={hour} className="absolute start-0 end-0 flex items-start" style={{ top: `${i * 72}px` }}>
          <span className="text-[11px] text-muted-foreground w-14 flex-shrink-0 -mt-2 font-medium" dir="ltr">{hour}</span>
          <div className="flex-1 border-t border-border/30" />
        </div>
      ))}
      {blocks.map((block) => {
        const cfg = categoryConfig[block.category];
        const isActive = activeBlock?.id === block.id;
        const isDragged = draggedBlockId === block.id;
        return (
          <div
            key={block.id}
            draggable
            onDragStart={() => onDragStart(block.id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(block.id)}
            className={cn(
              "absolute start-16 end-4 rounded-xl border px-3 py-2 flex items-start justify-between gap-2 transition-all hover:shadow-lg cursor-grab active:cursor-grabbing group",
              cfg.bg, cfg.border,
              isActive && "ring-2 ring-primary shadow-lg scale-[1.01]",
              isDragged && "opacity-50 scale-95"
            )}
            style={{ top: `${getBlockTop(block)}px`, height: `${getBlockHeight(block)}px`, minHeight: "40px" }}
          >
            <div className="flex items-start gap-2 min-w-0">
              <span className={cn("w-1.5 h-full rounded-full absolute start-0 top-0 bottom-0", cfg.dot)} />
              <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold truncate", cfg.text)}>{block.title}</p>
                <p className="text-[11px] text-muted-foreground" dir="ltr">{block.startTime} – {block.endTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isActive && (
                <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 animate-pulse shadow-sm">{t("blocking.live")}</Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg.text, cfg.border)}>{t(`blocking.category.${block.category}`)}</Badge>
              <button aria-label={t("blocking.remove")} onClick={(e) => { e.stopPropagation(); onRemove(block.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TimeBlocking;
