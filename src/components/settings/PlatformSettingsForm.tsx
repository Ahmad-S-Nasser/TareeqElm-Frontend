import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Globe, Palette, Bot, Save, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { getApiOrigin } from "@/hooks/useCourseEditor";
import { usePlatformSettingsQuery, useUpdatePlatformSettings, type PlatformSettingsUpdate } from "@/hooks/useSettings";
import api from "@/lib/api";

const TIMEZONES = ["UTC", "UTC-8", "UTC-5", "UTC+0", "UTC+1", "UTC+2", "UTC+3", "UTC+5:30", "UTC+8", "UTC+9", "UTC+10"];
const LANGUAGES = ["en", "ar"] as const;
const ACCENT_COLORS = ["#f43f5e", "#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];

interface UploadResponse {
  Url: string;
}

/** Absolute URL for a stored logo (relative `/uploads/...` paths need the API origin to render as an <img src>). */
const toAbsoluteUrl = (url: string | null): string | undefined => {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `${getApiOrigin()}${url}`;
};

interface PlatformSettingsFormProps {
  /** Translation namespace holding the "settings.*" strings (admin or organization). */
  ns: "admin" | "organization";
  /** Only settings.manage may persist changes; read-only elsewhere (defensive — the page itself is already gated). */
  canManage: boolean;
}

export const PlatformSettingsForm = ({ ns, canManage }: PlatformSettingsFormProps) => {
  const { t } = useTranslation(ns);
  const { toast } = useToast();
  const { data: settings, isLoading, isError, error } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState<PlatformSettingsUpdate>({});

  useEffect(() => {
    if (settings) {
      setForm({
        PlatformName: settings.PlatformName,
        LogoUrl: settings.LogoUrl ?? "",
        Timezone: settings.Timezone,
        DefaultLanguage: settings.DefaultLanguage,
        AccentColor: settings.AccentColor,
        AiEnabled: settings.AiEnabled,
        NotifyOnCompletion: settings.NotifyOnCompletion,
        NotifyOnAtRisk: settings.NotifyOnAtRisk,
      });
    }
  }, [settings]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<UploadResponse>("/Courses/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, LogoUrl: response.data.Url }));
    } catch (err) {
      toast({ variant: "destructive", title: t("settings.toast.logoUploadFailed"), description: getApiError(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      toast({ title: t("settings.toast.saved"), description: t("settings.toast.savedDescription") });
    } catch (err) {
      toast({ variant: "destructive", title: t("settings.toast.saveFailed"), description: getApiError(err) });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isError || !settings) {
    return <p className="text-center text-destructive py-16">{getApiError(error, t("settings.loadFailed"))}</p>;
  }

  const logoPreview = form.LogoUrl ? toAbsoluteUrl(form.LogoUrl) : undefined;

  return (
    <div className="space-y-6">
      {/* Platform */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-500" /> {t("settings.org.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">{t("settings.org.name")}</Label>
            <Input
              id="platform-name"
              placeholder={t("settings.org.namePlaceholder")}
              value={form.PlatformName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, PlatformName: e.target.value }))}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.org.logo")}</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 rounded-xl">
                {logoPreview && <AvatarImage src={logoPreview} alt="" />}
                <AvatarFallback className="rounded-xl bg-rose-500/10 text-rose-400 font-black text-xl">
                  {(form.PlatformName ?? "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" size="sm" disabled={!canManage || uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
                  {t("settings.org.uploadLogo")}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">{t("settings.org.logoHint")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locale */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> {t("settings.locale.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform-timezone">{t("settings.locale.timezone")}</Label>
              <Select value={form.Timezone ?? "UTC"} onValueChange={(v) => setForm((f) => ({ ...f, Timezone: v }))} disabled={!canManage}>
                <SelectTrigger id="platform-timezone"><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}><bdi dir="ltr">{tz}</bdi></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-language">{t("settings.locale.language")}</Label>
              <Select value={form.DefaultLanguage ?? "en"} onValueChange={(v) => setForm((f) => ({ ...f, DefaultLanguage: v }))} disabled={!canManage}>
                <SelectTrigger id="platform-language"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{t(`settings.languages.${l}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-500" /> {t("settings.branding.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.branding.accent")}</Label>
            <div className="flex items-center gap-3 flex-wrap">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t("settings.branding.pickColor", { color: c })}
                  onClick={() => canManage && setForm((f) => ({ ...f, AccentColor: c }))}
                  disabled={!canManage}
                  className={`w-9 h-9 rounded-xl transition-all duration-200 shadow-sm ${form.AccentColor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.AccentColor ?? "#f43f5e"}
                onChange={(e) => setForm((f) => ({ ...f, AccentColor: e.target.value }))}
                disabled={!canManage}
                className="w-9 h-9 rounded-xl cursor-pointer border border-border"
                title={t("settings.branding.customColor")}
                aria-label={t("settings.branding.customColor")}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: form.AccentColor ?? "#f43f5e" }} />
              <span dir="ltr" className="text-xs text-muted-foreground font-mono">{form.AccentColor}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI & Notifications */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-500" /> {t("settings.ai.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(
            [
              { key: "enable", label: t("settings.ai.enable"), sub: t("settings.ai.enableSub"), val: form.AiEnabled, set: (v: boolean) => setForm((f) => ({ ...f, AiEnabled: v })) },
              { key: "completion", label: t("settings.ai.notifyCompletion"), sub: t("settings.ai.notifyCompletionSub"), val: form.NotifyOnCompletion, set: (v: boolean) => setForm((f) => ({ ...f, NotifyOnCompletion: v })) },
              { key: "atRisk", label: t("settings.ai.notifyAtRisk"), sub: t("settings.ai.notifyAtRiskSub"), val: form.NotifyOnAtRisk, set: (v: boolean) => setForm((f) => ({ ...f, NotifyOnAtRisk: v })) },
            ] as const
          ).map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </div>
              <Switch checked={!!s.val} onCheckedChange={s.set} disabled={!canManage} aria-label={s.label} />
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage && (
        <Button
          className="w-full py-5 text-base font-semibold"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? <Loader2 className="w-5 h-5 me-2 animate-spin" /> : <Save className="w-5 h-5 me-2" />}
          {t("settings.save")}
        </Button>
      )}
    </div>
  );
};

export default PlatformSettingsForm;
