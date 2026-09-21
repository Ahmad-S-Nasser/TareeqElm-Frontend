import { useState } from "react";
import { UniversitySidebar, UniversitySidebarContent } from "@/components/layout/UniversitySidebar";
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

const UniversitySettings = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            toast({
                title: "Settings Saved",
                description: "Your university preferences have been updated.",
            });
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-background">
            <UniversitySidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="University"
                mobileSidebar={<UniversitySidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            <Settings className="w-8 h-8 text-primary" />
                            Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage university profile, billing, and system preferences.
                        </p>
                    </div>

                    <Tabs defaultValue="general" className="w-full animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-card border border-border/50 shadow-sm p-1 rounded-xl mb-6">
                            <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">General</TabsTrigger>
                            <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Billing</TabsTrigger>
                            <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Notifications</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>University Profile</CardTitle>
                                    <CardDescription>
                                        Update your institution's public information.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">University Name</Label>
                                        <Input id="name" defaultValue="LearnWise University" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="domain">Custom Domain</Label>
                                        <Input id="domain" defaultValue="university.example.edu" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="address">Address</Label>
                                        <Input id="address" defaultValue="123 Education Lane, Learning City" className="bg-background/50 focus-visible:ring-primary" />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                                        {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        <TabsContent value="billing">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>Subscription & Billing</CardTitle>
                                    <CardDescription>
                                        Manage your subscription plan and payment methods.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-accent/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Shield className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Enterprise Plan</p>
                                                <p className="text-sm text-muted-foreground">Active • Renews on Dec 31, 2024</p>
                                            </div>
                                        </div>
                                        <Button variant="outline">Manage</Button>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">Payment Method</h3>
                                        <div className="flex items-center gap-3 p-3 border border-border/50 rounded-xl bg-background/50">
                                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                                            <span className="text-sm">Visa ending in 4242</span>
                                            <Button variant="ghost" size="sm" className="ml-auto">Update</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notifications">
                            <Card className="border-border/50 shadow-soft">
                                <CardHeader>
                                    <CardTitle>Notification Preferences</CardTitle>
                                    <CardDescription>
                                        Configure how and when you receive alerts.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">System Alerts</Label>
                                            <p className="text-sm text-muted-foreground">Receive emails about critical system updates.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">New Instructor Applications</Label>
                                            <p className="text-sm text-muted-foreground">Notify when a new instructor applies.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Course Approvals</Label>
                                            <p className="text-sm text-muted-foreground">Notify when courses are submitted for approval.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                                        {loading ? "Saving..." : "Save Preferences"}
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

export default UniversitySettings;
