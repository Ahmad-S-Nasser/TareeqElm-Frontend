import { useEffect, useState } from "react";
import { ApplicantSidebar } from "@/components/layout/ApplicantSidebar";
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

const TrainerSettings = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();
    const { data: me, isLoading: profileLoading, isError, error, saveProfile, changePassword } = useProfile();

    const [name, setName] = useState({ firstName: "", lastName: "" });
    const [passwords, setPasswords] = useState({ current: "", next: "" });
    // Local-only preview toggles: there is no server-side notification preference yet.
    const [notifications, setNotifications] = useState({ assignments: true, reminders: true, announcements: false });

    useEffect(() => {
        if (me) {
            const { first, last } = splitName(me.FullName);
            setName({ firstName: first, lastName: last });
        }
    }, [me]);

    const handleSave = async () => {
        const fullName = `${name.firstName} ${name.lastName}`.trim();
        if (!fullName) {
            toast({ variant: "destructive", title: "Name is required" });
            return;
        }
        try {
            await saveProfile.mutateAsync({ FullName: fullName });
            toast({ title: "Settings Saved", description: "Your profile has been updated." });
        } catch (err) {
            toast({ variant: "destructive", title: "Could not save", description: getApiError(err, "Could not save your profile.") });
        }
    };

    const handlePassword = async () => {
        if (!passwords.current || passwords.next.length < 8) {
            toast({ variant: "destructive", title: "Check your passwords", description: "Enter your current password and a new one of at least 8 characters." });
            return;
        }
        try {
            await changePassword.mutateAsync({ CurrentPassword: passwords.current, NewPassword: passwords.next });
            setPasswords({ current: "", next: "" });
            toast({ title: "Password updated" });
        } catch (err) {
            toast({ variant: "destructive", title: "Could not update password", description: getApiError(err, "Could not update your password.") });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ml-20" : "ml-64"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">Account Settings</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your profile details and notifications.
                        </p>
                    </div>

                    <Tabs defaultValue="profile" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Profile</TabsTrigger>
                            <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
                            <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> Security</TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                    <CardDescription>Update your personal details.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {profileLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                    ) : isError ? (
                                        <p className="text-destructive text-sm">{getApiError(error, "Could not load your profile.")}</p>
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
                                                    <Label htmlFor="firstName">First Name</Label>
                                                    <Input id="firstName" value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">Last Name</Label>
                                                    <Input id="lastName" value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email Address</Label>
                                                <Input id="email" value={me?.Email ?? ""} disabled className="bg-muted" />
                                                <p className="text-xs text-muted-foreground">Contact support to change your email.</p>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handleSave} disabled={saveProfile.isPending || profileLoading || isError}>
                                        {saveProfile.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notifications">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Notification Preferences</CardTitle>
                                    <CardDescription>Email notifications are coming soon. These switches are a preview and are not saved yet.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Assignment Deadlines</Label>
                                                <p className="text-sm text-muted-foreground">Get reminded 24 hours before a due date.</p>
                                            </div>
                                            <Switch
                                                checked={notifications.assignments}
                                                onCheckedChange={(c) => setNotifications(p => ({ ...p, assignments: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Daily Study Reminders</Label>
                                                <p className="text-sm text-muted-foreground">Notifications to keep your streak alive.</p>
                                            </div>
                                            <Switch
                                                checked={notifications.reminders}
                                                onCheckedChange={(c) => setNotifications(p => ({ ...p, reminders: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>New Announcements</Label>
                                                <p className="text-sm text-muted-foreground">Updates from your instructors.</p>
                                            </div>
                                            <Switch
                                                checked={notifications.announcements}
                                                onCheckedChange={(c) => setNotifications(p => ({ ...p, announcements: c }))}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="security">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Password & Security</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Current Password</Label>
                                        <Input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>New Password</Label>
                                        <Input type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button onClick={handlePassword} disabled={changePassword.isPending}>{changePassword.isPending ? "Updating..." : "Update Password"}</Button>
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
