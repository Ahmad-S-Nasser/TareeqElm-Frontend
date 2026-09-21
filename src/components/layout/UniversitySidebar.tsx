import {
    LayoutDashboard,
    Users,
    Building2,
    Settings,
    LogOut,
    BookOpen,
    Menu,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    PieChart,
    Calendar,
    Layers,
    UserCheck,
    ClipboardList,
    Megaphone,
    FolderOpen,
    FileBarChart,
    Brain,
    ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
    onCollapse?: (collapsed: boolean) => void;
}

const menuItems = [
    { icon: LayoutDashboard, label: "Overview", path: "/university" },
    { icon: Building2, label: "Departments", path: "/university/departments" },
    { icon: Calendar, label: "Academic Terms", path: "/university/terms" },
    { icon: Layers, label: "Sections", path: "/university/sections" },
    { icon: Users, label: "Instructors", path: "/university/instructors" },
    { icon: GraduationCap, label: "Trainers", path: "/university/trainers" },
    { icon: BookOpen, label: "Courses", path: "/university/courses" },
    { icon: UserCheck, label: "Enrollment", path: "/university/enrollment" },
    { icon: ClipboardList, label: "Exams", path: "/university/exams" },
    { icon: Megaphone, label: "Announcements", path: "/university/announcements" },
    { icon: FolderOpen, label: "Content Library", path: "/university/content" },
    { icon: PieChart, label: "Analytics", path: "/university/analytics" },
    { icon: FileBarChart, label: "Reports", path: "/university/reports" },
    { icon: Brain, label: "AI Insights", path: "/university/ai-insights" },
    { icon: ShieldCheck, label: "Roles & Permissions", path: "/university/roles" },
    { icon: Settings, label: "Settings", path: "/university/settings" },
];

export const UniversitySidebarContent = ({ collapsed }: { collapsed: boolean }) => {
    const location = useLocation();
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate("/auth");
    };

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-r border-border/50">
            <div className={cn(
                "p-6 flex items-center gap-3",
                collapsed ? "justify-center px-2" : ""
            )}>
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                {!collapsed && (
                    <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                        UniAdmin
                    </span>
                )}
            </div>

            <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-none">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link to={item.path} key={item.path}>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-3 transition-all duration-300",
                                    isActive && "bg-primary/10 text-primary hover:bg-primary/20",
                                    collapsed ? "justify-center px-2" : "px-4"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                                {!collapsed && <span>{item.label}</span>}
                            </Button>
                        </Link>
                    );
                })}
            </div>

            <div className="p-4 border-t border-border/50">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10",
                        collapsed ? "justify-center px-2" : "px-4"
                    )}
                    onClick={handleSignOut}
                >
                    <LogOut className="w-5 h-5" />
                    {!collapsed && <span>Sign Out</span>}
                </Button>
            </div>
        </div>
    );
};

export const UniversitySidebar = ({ onCollapse }: SidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        onCollapse?.(collapsed);
    }, [collapsed, onCollapse]);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 h-screen z-40 hidden lg:block transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                <UniversitySidebarContent collapsed={collapsed} />

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -right-4 top-8 w-8 h-8 rounded-full border bg-background shadow-md z-50 hover:bg-accent"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </Button>
            </aside>
        </>
    );
};
