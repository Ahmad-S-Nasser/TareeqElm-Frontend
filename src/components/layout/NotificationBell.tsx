import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import Can from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationText,
  type NotificationItem,
} from "@/hooks/useNotifications";

const PANEL_LIMIT = 8;

const NotificationRow = ({ item, onNavigate }: { item: NotificationItem; onNavigate: (item: NotificationItem) => void }) => {
  const { title, body } = useNotificationText()(item);
  const { formatRelativeTime } = useFormatters();
  return (
    <button
      type="button"
      onClick={() => onNavigate(item)}
      className={cn(
        "w-full text-start p-3 rounded-lg hover:bg-muted/60 transition-colors flex gap-2 items-start",
        !item.Read && "bg-primary/5"
      )}
    >
      {!item.Read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
      <div className={cn("min-w-0 flex-1", item.Read && "ms-4")}>
        <p className={cn("text-sm truncate", !item.Read && "font-semibold")}>{title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{body}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(item.CreatedAt)}</p>
      </div>
    </button>
  );
};

/** Where "view all" (and a notification without a LinkUrl) should land, per role. Organization and Admin have
 *  no dedicated notifications page yet, so they land on the closest existing one (matches the header's own bell). */
const notificationsHomeFor = (role: string | null | undefined): string => {
  switch (role) {
    case "instructor": return "/instructor/notifications";
    case "organization": return "/organization/announcements";
    case "admin": return "/admin";
    default: return "/notifications";
  }
};

export const NotificationBell = () => {
  const { t } = useTranslation(["notifications", "nav"]);
  const navigate = useNavigate();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCountQuery();
  const { data: items = [], isLoading, isError } = useNotificationsQuery();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { formatNumber } = useFormatters();

  const home = notificationsHomeFor(role);

  const handleNavigate = (item: NotificationItem) => {
    if (!item.Read) markRead.mutate(item.Id);
    setOpen(false);
    navigate(item.LinkUrl || home);
  };

  return (
    <Can permission={PERMISSIONS.notificationsUse}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={unreadCount > 0 ? t("nav:header.notifications") + ` (${formatNumber(unreadCount)})` : t("nav:header.notifications")}
            className="relative hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 end-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center border-2 border-background">
                {unreadCount > 99 ? "99+" : formatNumber(unreadCount)}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 mt-2 p-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-semibold">{t("notifications:panel.title")}</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <Check className="w-3 h-3 me-1" /> {t("notifications:panel.markAllRead")}
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : isError ? (
              <p className="text-center text-sm text-destructive py-8">{t("notifications:panel.loadFailed")}</p>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">{t("notifications:panel.empty")}</p>
            ) : (
              <div className="p-1 space-y-0.5">
                {items.slice(0, PANEL_LIMIT).map((item) => (
                  <NotificationRow key={item.Id} item={item} onNavigate={handleNavigate} />
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false);
                navigate(home);
              }}
            >
              {t("notifications:panel.viewAll")}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );
};

export default NotificationBell;
