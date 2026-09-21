import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Shield, CreditCard, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useFormatters } from "@/lib/format";

const OrganizationSettings = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate } = useFormatters();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            toast({
                title: t("settings.saved"),
                description: t("settings.savedDescription"),
            });
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Organization"
                mobileSidebar={<OrganizationSidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            <Settings className="w-8 h-8 text-primary" />
                            {t("settings.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t("settings.subtitle")}
                        </p>
                    </div>

                    <Tabs defaultValue="general" className="w-full animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-card border border-border/50 shadow-sm p-1 rounded-xl mb-6">
                            <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("settings.tabs.general")}</TabsTrigger>
                            <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("settings.tabs.billing")}</TabsTrigger>
                            <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("settings.tabs.notifications")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>{t("settings.profile.title")}</CardTitle>
                                    <CardDescription>
                                        {t("settings.profile.description")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">{t("settings.profile.name")}</Label>
                                        <Input id="name" defaultValue="My Organization" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="domain">{t("settings.profile.domain")}</Label>
                                        <Input id="domain" dir="ltr" defaultValue="organization.example.com" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="address">{t("settings.profile.address")}</Label>
                                        <Input id="address" defaultValue="123 Education Lane, Learning City" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                                        {loading ? t("common:states.saving") : <><Save className="w-4 h-4 me-2" /> {t("settings.saveChanges")}</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        <TabsContent value="billing">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>{t("settings.billing.title")}</CardTitle>
                                    <CardDescription>
                                        {t("settings.billing.description")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-accent/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Shield className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{t("settings.billing.plan")}</p>
                                                <p className="text-sm text-muted-foreground">{t("settings.billing.renews", { date: formatDate("2024-12-31T00:00:00Z", { timeZone: "UTC" }) })}</p>
                                            </div>
                                        </div>
                                        <Button variant="outline">{t("settings.billing.manage")}</Button>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">{t("settings.billing.paymentMethod")}</h3>
                                        <div className="flex items-center gap-3 p-3 border border-border/50 rounded-xl bg-background/50">
                                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                                            <span className="text-sm">{t("settings.billing.card", { last4: "4242" })}</span>
                                            <Button variant="ghost" size="sm" className="ms-auto">{t("settings.billing.update")}</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notifications">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>{t("settings.notifications.title")}</CardTitle>
                                    <CardDescription>
                                        {t("settings.notifications.description")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">{t("settings.notifications.systemAlerts")}</Label>
                                            <p className="text-sm text-muted-foreground">{t("settings.notifications.systemAlertsHint")}</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">{t("settings.notifications.applications")}</Label>
                                            <p className="text-sm text-muted-foreground">{t("settings.notifications.applicationsHint")}</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">{t("settings.notifications.approvals")}</Label>
                                            <p className="text-sm text-muted-foreground">{t("settings.notifications.approvalsHint")}</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                                        {loading ? t("common:states.saving") : t("settings.savePreferences")}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default OrganizationSettings;
