import { useEffect, useState } from "react";
import { ApplicantSidebar } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bell, Lock, Save, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useProfile, splitName, initials } from "@/hooks/useProfile";
import { NotificationPreferencesCard } from "@/components/settings/NotificationPreferencesCard";

const TrainerSettings = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();
    const { t } = useTranslation(["dashboard", "common"]);
    const { data: me, isLoading: profileLoading, isError, error, saveProfile, changePassword } = useProfile();

    const [name, setName] = useState({ firstName: "", lastName: "" });
    const [passwords, setPasswords] = useState({ current: "", next: "" });

    useEffect(() => {
        if (me) {
            const { first, last } = splitName(me.FullName);
            setName({ firstName: first, lastName: last });
        }
    }, [me]);

    const handleSave = async () => {
        const fullName = `${name.firstName} ${name.lastName}`.trim();
        if (!fullName) {
            toast({ variant: "destructive", title: t("settings.nameRequired") });
            return;
        }
        try {
            await saveProfile.mutateAsync({ FullName: fullName });
            toast({ title: t("settings.saved"), description: t("settings.savedDesc") });
        } catch (err) {
            toast({ variant: "destructive", title: t("settings.saveFailed"), description: getApiError(err, t("settings.saveFailedDesc")) });
        }
    };

    const handlePassword = async () => {
        if (!passwords.current || passwords.next.length < 8) {
            toast({ variant: "destructive", title: t("settings.checkPasswords"), description: t("settings.checkPasswordsDesc") });
            return;
        }
        try {
            await changePassword.mutateAsync({ CurrentPassword: passwords.current, NewPassword: passwords.next });
            setPasswords({ current: "", next: "" });
            toast({ title: t("settings.passwordUpdated") });
        } catch (err) {
            toast({ variant: "destructive", title: t("settings.passwordFailed"), description: getApiError(err, t("settings.passwordFailedDesc")) });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" />

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

                        <TabsContent value="profile">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("settings.personalInfo")}</CardTitle>
                                    <CardDescription>{t("settings.personalInfoDesc")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {profileLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                    ) : isError ? (
                                        <p className="text-destructive text-sm">{getApiError(error, t("settings.loadFailed"))}</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-6">
                                                <Avatar className="w-20 h-20">
                                                    {me?.AvatarUrl && <AvatarImage src={me.AvatarUrl} />}
                                                    <AvatarFallback className="text-lg">{initials(me?.FullName ?? "")}</AvatarFallback>
                                                </Avatar>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="firstName">{t("settings.firstName")}</Label>
                                                    <Input id="firstName" value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">{t("settings.lastName")}</Label>
                                                    <Input id="lastName" value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email">{t("settings.email")}</Label>
                                                <Input id="email" dir="ltr" value={me?.Email ?? ""} disabled className="bg-muted text-start" />
                                                <p className="text-xs text-muted-foreground">{t("settings.emailHint")}</p>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handleSave} disabled={saveProfile.isPending || profileLoading || isError}>
                                        {saveProfile.isPending ? t("common:states.saving") : <><Save className="w-4 h-4 me-2" /> {t("settings.saveChanges")}</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notifications">
                            <NotificationPreferencesCard />
                        </TabsContent>

                        <TabsContent value="security">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("settings.passwordSecurity")}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="current-password">{t("settings.currentPassword")}</Label>
                                        <Input id="current-password" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
                                        <Input id="new-password" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handlePassword} disabled={changePassword.isPending}>{changePassword.isPending ? t("settings.updating") : t("settings.updatePassword")}</Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default TrainerSettings;
