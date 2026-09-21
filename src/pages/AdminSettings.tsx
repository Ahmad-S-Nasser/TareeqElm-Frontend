import { useState } from "react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Globe, Palette, Bot, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const AdminSettings = () => {
    const { t } = useTranslation("admin");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();

    const [orgName, setOrgName] = useState("");
    const [timezone, setTimezone] = useState("UTC+2");
    const [language, setLanguage] = useState("en");
    const [accent, setAccent] = useState("#f43f5e");
    const [aiEnabled, setAiEnabled] = useState(true);
    const [notifyOnCompletion, setNotifyOnCompletion] = useState(true);
    const [notifyAtRisk, setNotifyAtRisk] = useState(true);

    const handleSave = () => {
        toast({ title: t("settings.toast.saved"), description: t("settings.toast.savedDescription") });
    };

    const timezones = ["UTC-8", "UTC-5", "UTC+0", "UTC+1", "UTC+2", "UTC+3", "UTC+5:30", "UTC+8", "UTC+9", "UTC+10"];
    const languages = ["en", "ar", "fr", "de", "es"];
    const accentColors = ["#f43f5e", "#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-black">{t("settings.title")}</h1>
                        <p className="text-muted-foreground text-sm mt-1">{t("settings.subtitle")}</p>
                    </div>

                    {/* Organization */}
                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-rose-500" /> {t("settings.org.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="org-name">{t("settings.org.name")}</Label>
                                <Input id="org-name" placeholder={t("settings.org.namePlaceholder")} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("settings.org.logo")}</Label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-rose-500/10 border-2 border-dashed border-rose-300 flex items-center justify-center text-rose-400 font-black text-xl cursor-pointer hover:bg-rose-500/20 transition-colors">
                                        {orgName.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <Button variant="outline" size="sm" onClick={() => toast({ title: t("settings.toast.logo"), description: t("settings.toast.logoDescription") })}>{t("settings.org.uploadLogo")}</Button>
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
                                    <Label>{t("settings.locale.timezone")}</Label>
                                    <Select value={timezone} onValueChange={setTimezone}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}><bdi dir="ltr">{tz}</bdi></SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("settings.locale.language")}</Label>
                                    <Select value={language} onValueChange={setLanguage}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{languages.map(l => <SelectItem key={l} value={l}>{t(`settings.languages.${l}`)}</SelectItem>)}</SelectContent>
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
                                    {accentColors.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            aria-label={t("settings.branding.pickColor", { color: c })}
                                            onClick={() => setAccent(c)}
                                            className={cn("w-9 h-9 rounded-xl transition-all duration-200 shadow-sm", accent === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105")}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-9 h-9 rounded-xl cursor-pointer border border-border" title={t("settings.branding.customColor")} aria-label={t("settings.branding.customColor")} />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: accent }} />
                                    <span dir="ltr" className="text-xs text-muted-foreground font-mono">{accent}</span>
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
                            {[
                                { key: "enable", label: t("settings.ai.enable"), sub: t("settings.ai.enableSub"), val: aiEnabled, set: setAiEnabled },
                                { key: "completion", label: t("settings.ai.notifyCompletion"), sub: t("settings.ai.notifyCompletionSub"), val: notifyOnCompletion, set: setNotifyOnCompletion },
                                { key: "atRisk", label: t("settings.ai.notifyAtRisk"), sub: t("settings.ai.notifyAtRiskSub"), val: notifyAtRisk, set: setNotifyAtRisk },
                            ].map((s) => (
                                <div key={s.key} className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-sm">{s.label}</p>
                                        <p className="text-xs text-muted-foreground">{s.sub}</p>
                                    </div>
                                    <Switch checked={s.val} onCheckedChange={s.set} aria-label={s.label} />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Button className="w-full bg-rose-500 hover:bg-rose-600 text-white border-0 py-5 text-base font-semibold" onClick={handleSave}>
                        <Save className="w-5 h-5 me-2" /> {t("settings.save")}
                    </Button>
                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
