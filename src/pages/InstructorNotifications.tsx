import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Trash2, AlertCircle, Loader2 } from "lucide-react";
import {
  useNotificationsQuery,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useNotificationText,
  type NotificationItem,
} from "@/hooks/useNotifications";

const InstructorNotifications = () => {
    const { t } = useTranslation(["notifications", "instructor"]);
    const { formatRelativeTime } = useFormatters();
    const localize = useNotificationText();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [filter, setFilter] = useState<"all" | "unread">("all");
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Instructor"
                mobileSidebar={<InstructorSidebarContent />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">{t("instructor:notifications.title")}</h1>
                            <p className="text-muted-foreground mt-1">
                                {t("instructor:notifications.subtitle")}
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                                <Check className="w-4 h-4 me-2" /> {t("notifications:page.markAllRead")}
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
                            {t("notifications:page.allTab")}
                        </Button>
                        <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>
                            {t("notifications:page.unreadTab")}
                        </Button>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : isError ? (
                                <div className="p-12 text-center">
                                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
                                    <p className="text-destructive">{getApiError(error, t("notifications:page.loadFailed"))}</p>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    {t("notifications:page.empty")}
                                </div>
                            ) : (
                                <ScrollArea className="h-[600px]">
                                    <div className="divide-y">
                                        {items.map((n) => {
                                            const { title, body } = localize(n);
                                            return (
                                                <div
                                                    key={n.Id}
                                                    className={cn(
                                                        "flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                                                        !n.Read && "bg-muted/20"
                                                    )}
                                                    onClick={() => handleOpen(n)}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0",
                                                        !n.Read && "border-primary/50 shadow-sm"
                                                    )}>
                                                        <Bell className={cn("w-5 h-5", !n.Read ? "text-primary" : "text-muted-foreground")} />
                                                    </div>
                                                    <div className="flex-1 space-y-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className={cn("text-sm font-medium", !n.Read && "font-bold")}>{title}</p>
                                                            <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(n.CreatedAt)}</span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{body}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {!n.Read && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-destructive"
                                                            aria-label={t("notifications:page.delete")}
                                                            onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.Id); }}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default InstructorNotifications;
