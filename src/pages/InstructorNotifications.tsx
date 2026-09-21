import { useState } from "react";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, UserPlus, MessageSquare, BookOpen, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Notification {
    id: number;
    title: string;
    message: string;
    type: "enrollment" | "message" | "system" | "course";
    time: string;
    read: boolean;
}

const InstructorNotifications = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([
        { id: 1, title: "New Enrollment", message: "Jane Smith enrolled in 'Advanced React Patterns'", type: "enrollment", time: "25 min ago", read: false },
        { id: 2, title: "New Question", message: "Mike Johnson asked a question in 'Module 3: Hooks'", type: "message", time: "1 hour ago", read: false },
        { id: 3, title: "System Maintenance", message: "Platform maintenance scheduled for Saturday 2am EST.", type: "system", time: "5 hours ago", read: true },
        { id: 4, title: "Course Published", message: "Your course 'Intro to Python' is now live.", type: "course", time: "1 day ago", read: true },
        { id: 5, title: "Review Goal Met", message: "You reached 100 positive reviews!", type: "enrollment", time: "2 days ago", read: true },
    ]);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = (id: number) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "enrollment": return <UserPlus className="w-5 h-5 text-blue-500" />;
            case "message": return <MessageSquare className="w-5 h-5 text-green-500" />;
            case "course": return <BookOpen className="w-5 h-5 text-purple-500" />;
            default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Instructor"
                mobileSidebar={<InstructorSidebarContent />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Notifications</h1>
                            <p className="text-muted-foreground mt-1">
                                Stay updated with trainer activity and system alerts.
                            </p>
                        </div>
                        <Button variant="outline" onClick={markAllRead}>
                            <Check className="w-4 h-4 mr-2" /> Mark all as read
                        </Button>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[600px]">
                                <div className="divide-y">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No notifications found.
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className={cn(
                                                    "flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors",
                                                    !notification.read && "bg-muted/20"
                                                )}
                                                onClick={() => markRead(notification.id)}
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0",
                                                    !notification.read && "border-primary/50 shadow-sm"
                                                )}>
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className={cn("text-sm font-medium", !notification.read && "font-bold")}>
                                                            {notification.title}
                                                        </p>
                                                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                </div>
                                                {!notification.read && (
                                                    <span className="w-2 h-2 rounded-full bg-primary mt-2" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default InstructorNotifications;
