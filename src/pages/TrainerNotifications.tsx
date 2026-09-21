import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Bell, Check, RotateCcw, Target, Flame, Clock, TrendingDown,
  BookOpen, BellRing, Sparkles, ArrowRight, Loader2, AlertCircle
} from "lucide-react";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";

const iconMap: Record<string, React.ElementType> = {
  flashcards_due: RotateCcw,
  goal_unmet: Target,
  focus_drop: TrendingDown,
  streak_risk: Flame,
  achievement: Sparkles,
  study_reminder: BookOpen,
  weekly_report: Clock,
};

const colorMap: Record<string, string> = {
  flashcards_due: "text-rose-500",
  goal_unmet: "text-amber-500",
  focus_drop: "text-orange-500",
  streak_risk: "text-red-500",
  achievement: "text-primary",
  study_reminder: "text-blue-500",
  weekly_report: "text-emerald-500",
};

const priorityBadge: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

const TrainerNotifications = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { notifications, loading, error, unreadCount, markRead, markAllRead, pushEnabled, requestPushPermission } = useSmartNotifications();

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter(n => n.type === filter);

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "flashcards_due", label: "Flashcards" },
    { value: "streak_risk", label: "Streaks" },
    { value: "goal_unmet", label: "Goals" },
    { value: "focus_drop", label: "Focus" },
    { value: "study_reminder", label: "Reminders" },
    { value: "achievement", label: "Achievements" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        userRole="Trainer"
        mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />}
      />

      <main className={cn(
        "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-64", "ml-0"
      )}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Smart Notifications</h1>
                <p className="text-muted-foreground text-sm">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Push</span>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={() => !pushEnabled && requestPushPermission()}
                />
              </div>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllRead}>
                  <Check className="w-4 h-4 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map(opt => (
              <Button
                key={opt.value}
                variant={filter === opt.value ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="font-medium">Could not load notifications</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">
                  {filter === "all" ? "No notifications right now" : `No ${filter.replace('_', ' ')} notifications`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filter === "all"
                    ? "Smart alerts will appear based on your study activity"
                    : "Try a different filter or check back later"
                  }
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/")}>
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n) => {
                const Icon = iconMap[n.type] || Bell;
                const color = colorMap[n.type] || "text-primary";
                return (
                  <Card
                    key={n.id}
                    className={cn(
                      "transition-all duration-200 cursor-pointer hover:shadow-md",
                      !n.read && "border-primary/20 bg-primary/[0.02]"
                    )}
                    onClick={() => markRead(n.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        !n.read ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Icon className={cn("w-5 h-5", color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn("text-sm font-medium", !n.read && "font-semibold")}>{n.title}</p>
                          <Badge variant="outline" className={cn("text-[10px]", priorityBadge[n.priority])}>
                            {n.priority}
                          </Badge>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{n.message}</p>
                      </div>
                      {n.actionUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={(e) => { e.stopPropagation(); navigate(n.actionUrl!); }}
                        >
                          {n.actionLabel || 'Go'} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TrainerNotifications;
