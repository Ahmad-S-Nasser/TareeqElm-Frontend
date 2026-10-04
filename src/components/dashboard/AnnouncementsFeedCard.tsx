import { useTranslation } from "react-i18next";
import { Megaphone, Pin, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { useAnnouncementsQuery } from "@/hooks/useAnnouncements";

const FEED_LIMIT = 4;

/** Small announcements feed for the trainer dashboard, backed by GET /api/announcements (already scoped server-side). */
export const AnnouncementsFeedCard = () => {
  const { t } = useTranslation("dashboard");
  const { formatRelativeTime } = useFormatters();
  const { data: announcements = [], isLoading, isError, error } = useAnnouncementsQuery();
  const items = announcements.slice(0, FEED_LIMIT);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="w-4 h-4 text-primary" /> {t("announcementsFeed.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {getApiError(error, t("announcementsFeed.loadFailed"))}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("announcementsFeed.empty")}</p>
        ) : (
          items.map((a) => (
            <div key={a.Id} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold flex items-center gap-1.5 truncate">
                  {a.Pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  <span className="truncate">{a.Title}</span>
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(a.CreatedAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{a.Body}</p>
              {a.CourseTitle && <Badge variant="outline" className="text-[10px]">{a.CourseTitle}</Badge>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementsFeedCard;
