import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { NOTIFICATION_TYPES, usePreferencesQuery, useUpdatePreferences, type NotificationTypeName } from "@/hooks/useSettings";

/**
 * Per-notification-type on/off switches, wired to GET/PUT /api/auth/me/preferences.
 * Shared across the Trainer / Instructor / Organization / Admin settings pages.
 */
export const NotificationPreferencesCard = () => {
  const { t } = useTranslation(["notifications", "common"]);
  const { toast } = useToast();
  const { data: preferences, isLoading, isError, error } = usePreferencesQuery();
  const updatePreferences = useUpdatePreferences();
  const [pendingType, setPendingType] = useState<NotificationTypeName | null>(null);

  const handleToggle = async (type: NotificationTypeName, enabled: boolean) => {
    setPendingType(type);
    try {
      await updatePreferences.mutateAsync({ Notifications: { [type]: enabled } });
    } catch (err) {
      toast({ variant: "destructive", title: t("notifications:settings.saveFailed"), description: getApiError(err) });
    } finally {
      setPendingType(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4" /> {t("notifications:settings.title")}
        </CardTitle>
        <CardDescription>{t("notifications:settings.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <p className="text-sm text-destructive">{getApiError(error, t("notifications:settings.loadFailed"))}</p>
        ) : (
          NOTIFICATION_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between gap-4">
              <Label htmlFor={`notif-${type}`} className="text-sm font-normal">
                {t(`notifications:types.${type}`)}
              </Label>
              <Switch
                id={`notif-${type}`}
                checked={preferences?.Notifications[type] ?? true}
                disabled={pendingType === type}
                onCheckedChange={(checked) => handleToggle(type, checked)}
                aria-label={t(`notifications:types.${type}`)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesCard;
