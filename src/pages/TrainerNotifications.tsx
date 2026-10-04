import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Bell, Check, Trash2, BellRing, ArrowRight, Loader2, AlertCircle
} from "lucide-react";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import {
  useNotificationsQuery,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useNotificationText,
  type NotificationItem,
} from "@/hooks/useNotifications";

const TrainerNotifications = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();
  const { t } = useTranslation(["notifications", "dashboard"]);
  const { formatRelativeTime } = useFormatters();
  const localize = useNotificationText();
  const { pushEnabled, requestPushPermission } = useSmartNotifications();

  const { data: items = [], isLoading, isError, error } = useNotificationsQuery(filter === "unread" ? true : undefined);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const unreadCount = items.filter((n) => !n.Read).length;

  const handleOpen = (n: NotificationItem) => {
    if (!n.Read) markRead.mutate(n.Id);
    if (n.LinkUrl) navigate(n.LinkUrl);
  };

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
        sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0"
      )}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("notifications:page.title")}</h1>
                <p className="text-muted-foreground text-sm">
                  {unreadCount > 0 ? t("notifications:page.unreadCount", { count: unreadCount }) : t("dashboard:notifications.allCaughtUp")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("dashboard:notifications.push")}</span>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={() => !pushEnabled && requestPushPermission()}
                />
              </div>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                  <Check className="w-4 h-4 me-1" /> {t("notifications:page.markAllRead")}
                </Button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setFilter("all")}>
              {t("notifications:page.allTab")}
            </Button>
            <Button variant={filter === "unread" ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setFilter("unread")}>
              {t("notifications:page.unreadTab")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">{t("notifications:page.loading")}</p>
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="font-medium">{t("notifications:page.loadFailed")}</p>
                <p className="text-sm text-muted-foreground mt-1">{getApiError(error)}</p>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">{t("notifications:page.empty")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("notifications:page.emptyHint")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((n) => {
                const { title, body } = localize(n);
                return (
                  <Card
                    key={n.Id}
                    className={cn(
                      "transition-all duration-200 cursor-pointer hover:shadow-md",
                      !n.Read && "border-primary/20 bg-primary/[0.02]"
                    )}
                    onClick={() => handleOpen(n)}
                  >
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        !n.Read ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Bell className={cn("w-5 h-5", !n.Read ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn("text-sm font-medium", !n.Read && "font-semibold")}>{title}</p>
                          {!n.Read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(n.CreatedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.LinkUrl && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleOpen(n); }}>
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={t("notifications:page.delete")}
                          disabled={deleteNotification.isPending}
                          onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.Id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
