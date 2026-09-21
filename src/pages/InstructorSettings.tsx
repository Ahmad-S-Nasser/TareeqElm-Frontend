import { useEffect, useState } from "react";
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
            toast({ variant: "destructive", title: "Name is required" });
            return;
        }
        try {
            await saveProfile.mutateAsync({ FullName: fullName });
            toast({ title: "Profile Saved", description: "Your changes have been updated successfully." });
        } catch (err) {
            toast({ variant: "destructive", title: "Could not save", description: getApiError(err, "Could not save your profile.") });
        }
    };

    const handlePassword = async () => {
        if (!passwords.current || passwords.next.length < 8) {
            toast({ variant: "destructive", title: "Check your passwords", description: "Enter your current password and a new one of at least 8 characters." });
            return;
        }
        if (passwords.next !== passwords.confirm) {
            toast({ variant: "destructive", title: "Passwords do not match" });
            return;
        }
        try {
            await changePassword.mutateAsync({ CurrentPassword: passwords.current, NewPassword: passwords.next });
            setPasswords({ current: "", next: "", confirm: "" });
            toast({ title: "Password updated" });
        } catch (err) {
            toast({ variant: "destructive", title: "Could not update password", description: getApiError(err, "Could not update your password.") });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Instructor" />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ml-20" : "ml-64"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">Settings</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your account preferences and instructor profile.
                        </p>
                    </div>

                    <Tabs defaultValue="profile" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Profile</TabsTrigger>
                            <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
                            <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> Security</TabsTrigger>
                        </TabsList>

                        {/* Profile Settings */}
                        <TabsContent value="profile">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Public Profile</CardTitle>
                                    <CardDescription>Your name is displayed to trainers on your course pages.</CardDescription>
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
                                                <div>
                                                    <p className="font-semibold">{me?.FullName}</p>
                                                    <p className="text-sm text-muted-foreground">{me?.Email}</p>
                                                </div>
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

                        {/* Notification Settings */}
                        <TabsContent value="notifications">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Notifications</CardTitle>
                                    <CardDescription>Email notifications are coming soon. These switches are a preview and are not saved yet.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">Email Notifications</h3>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>New Enrollments</Label>
                                                <p className="text-sm text-muted-foreground">Receive an email when a trainer enrolls.</p>
                                            </div>
                                            <Switch
                                                checked={emailNotifications.enrollments}
                                                onCheckedChange={(c) => setEmailNotifications(p => ({ ...p, enrollments: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Course Completions</Label>
                                                <p className="text-sm text-muted-foreground">Receive an email when a trainer completes a course.</p>
                                            </div>
                                            <Switch
                                                checked={emailNotifications.completions}
                                                onCheckedChange={(c) => setEmailNotifications(p => ({ ...p, completions: c }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Q&A Updates</Label>
                                                <p className="text-sm text-muted-foreground">Receive an email when a trainer asks a question.</p>
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
                                    <CardTitle>Security</CardTitle>
                                    <CardDescription>Manage your password and account security.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="current-password">Current Password</Label>
                                        <Input id="current-password" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="new-password">New Password</Label>
                                            <Input id="new-password" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-password">Confirm Password</Label>
                                            <Input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                                        </div>
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

export default InstructorSettings;
