import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bell, Lock, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useProfile, splitName, initials } from "@/hooks/useProfile";

const InstructorSettings = () => {
    const { t } = useTranslation("instructor");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();
    const { data: me, isLoading: profileLoading, isError, error, saveProfile, changePassword } = useProfile();

    const [name, setName] = useState({ firstName: "", lastName: "" });
    const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
    // Local-only preview toggles: there is no server-side notification preference yet.
    const [emailNotifications, setEmailNotifications] = useState({ enrollments: true, completions: true, questions: false });

    useEffect(() => {
        if (me) {
            const { first, last } = splitName(me.FullName);
            setName({ firstName: first, lastName: last });
        }
    }, [me]);

    const handleSave = async () => {
        const fullName = `${name.firstName} ${name.lastName}`.trim();
        if (!fullName) {
            toast({ variant: "destructive", title: t("settings.profile.nameRequired") });
            return;
        }
        try {
            await saveProfile.mutateAsync({ FullName: fullName });
            toast({ title: t("settings.profile.saved"), description: t("settings.profile.savedDesc") });
        } catch (err) {
            toast({ variant: "destructive", title: t("settings.profile.saveFailed"), description: getApiError(err, t("settings.profile.saveFailedDesc")) });
        }
    };

    const handlePassword = async () => {
        if (!passwords.current || passwords.next.length < 8) {
            toast({ variant: "destructive", title: t("settings.security.checkTitle"), description: t("settings.security.checkDesc") });
            return;
        }
        if (passwords.next !== passwords.confirm) {
            toast({ variant: "destructive", title: t("settings.security.mismatch") });
            return;
        }
        try {
            await changePassword.mutateAsync({ CurrentPassword: passwords.current, NewPassword: passwords.next });
            setPasswords({ current: "", next: "", confirm: "" });
            toast({ title: t("settings.security.updated") });
        } catch (err) {
            toast({ variant: "destructive", title: t("settings.security.failed"), description: getApiError(err, t("settings.security.failedDesc")) });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Instructor" />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ms-20" : "ms-64"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t("settings.subtitle")}
                        </p>
                    </div>

                    <Tabs defaultValue="profile" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> {t("settings.tabs.profile")}</TabsTrigger>
                            <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> {t("settings.tabs.notifications")}</TabsTrigger>
                            <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> {t("settings.tabs.security")}</TabsTrigger>
                        </TabsList>

                        {/* Profile Settings */}
                        <TabsContent value="profile">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("settings.profile.title")}</CardTitle>
                                    <CardDescription>{t("settings.profile.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {profileLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                    ) : isError ? (
                                        <p className="text-destructive text-sm">{getApiError(error, t("settings.profile.loadFailed"))}</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-6">
                                                <Avatar className="w-20 h-20">
                                                    {me?.AvatarUrl && <AvatarImage src={me.AvatarUrl} />}
                                                    <AvatarFallback className="text-lg">{initials(me?.FullName ?? "")}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold">{me?.FullName}</p>
                                                    <p className="text-sm text-muted-foreground" dir="ltr">{me?.Email}</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="firstName">{t("settings.profile.firstName")}</Label>
                                                    <Input id="firstName" value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">{t("settings.profile.lastName")}</Label>
                                                    <Input id="lastName" value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handleSave} disabled={saveProfile.isPending || profileLoading || isError}>
                                        {saveProfile.isPending ? t("settings.profile.saving") : <><Save className="w-4 h-4 me-2" /> {t("settings.profile.save")}</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        {/* Notification Settings */}
                        <TabsContent value="notifications">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("settings.notifications.title")}</CardTitle>
                                    <CardDescription>{t("settings.notifications.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">{t("settings.notifications.emailHeading")}</h3>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>{t("settings.notifications.enrollments")}</Label>
                                                <p className="text-sm text-muted-foreground">{t("settings.notifications.enrollmentsDesc")}</p>
                                            </div>
                                            <Switch
                                                checked={emailNotifications.enrollments}
                                                onCheckedChange={(c) => setEmailNotifications(p => ({ ...p, enrollments: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>{t("settings.notifications.completions")}</Label>
                                                <p className="text-sm text-muted-foreground">{t("settings.notifications.completionsDesc")}</p>
                                            </div>
                                            <Switch
                                                checked={emailNotifications.completions}
                                                onCheckedChange={(c) => setEmailNotifications(p => ({ ...p, completions: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>{t("settings.notifications.questions")}</Label>
                                                <p className="text-sm text-muted-foreground">{t("settings.notifications.questionsDesc")}</p>
                                            </div>
                                            <Switch
                                                checked={emailNotifications.questions}
                                                onCheckedChange={(c) => setEmailNotifications(p => ({ ...p, questions: c }))}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Security Settings */}
                        <TabsContent value="security">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("settings.security.title")}</CardTitle>
                                    <CardDescription>{t("settings.security.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="current-password">{t("settings.security.current")}</Label>
                                        <Input id="current-password" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="new-password">{t("settings.security.next")}</Label>
                                            <Input id="new-password" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-password">{t("settings.security.confirm")}</Label>
                                            <Input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handlePassword} disabled={changePassword.isPending}>{changePassword.isPending ? t("settings.security.updating") : t("settings.security.update")}</Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default InstructorSettings;
