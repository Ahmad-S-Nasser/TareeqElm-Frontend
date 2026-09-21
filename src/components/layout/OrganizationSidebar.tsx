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
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
    onCollapse?: (collapsed: boolean) => void;
}

const menuItems = [
    { icon: LayoutDashboard, labelKey: "overview", path: "/organization" },
    { icon: Building2, labelKey: "departments", path: "/organization/departments" },
    { icon: Calendar, labelKey: "academicTerms", path: "/organization/terms" },
    { icon: Layers, labelKey: "sections", path: "/organization/sections" },
    { icon: Users, labelKey: "instructors", path: "/organization/instructors" },
    { icon: GraduationCap, labelKey: "trainers", path: "/organization/trainers" },
    { icon: BookOpen, labelKey: "courses", path: "/organization/courses" },
    { icon: UserCheck, labelKey: "enrollment", path: "/organization/enrollment" },
    { icon: ClipboardList, labelKey: "exams", path: "/organization/exams" },
    { icon: Megaphone, labelKey: "announcements", path: "/organization/announcements" },
    { icon: FolderOpen, labelKey: "contentLibrary", path: "/organization/content" },
    { icon: PieChart, labelKey: "analytics", path: "/organization/analytics" },
    { icon: FileBarChart, labelKey: "reports", path: "/organization/reports" },
    { icon: Brain, labelKey: "aiInsights", path: "/organization/ai-insights" },
    { icon: ShieldCheck, labelKey: "rolesPermissions", path: "/organization/roles" },
    { icon: Settings, labelKey: "settings", path: "/organization/settings" },
];

export const OrganizationSidebarContent = ({ collapsed }: { collapsed: boolean }) => {
    const location = useLocation();
    const { t } = useTranslation("nav");
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate("/auth");
    };

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-e border-border/50">
            <div className={cn(
                "p-6 flex items-center gap-3",
                collapsed ? "justify-center px-2" : ""
            )}>
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                {!collapsed && (
                    <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                        {t("sidebar.brand.organization")}
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
                                {!collapsed && <span>{t(`sidebar.organization.${item.labelKey}`)}</span>}
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
                    {!collapsed && <span>{t("sidebar.signOut")}</span>}
                </Button>
                {!collapsed && <LanguageSwitcher className="mt-3 lg:hidden" />}
            </div>
        </div>
    );
};

export const OrganizationSidebar = ({ onCollapse }: SidebarProps) => {
    const { t } = useTranslation("nav");
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        onCollapse?.(collapsed);
    }, [collapsed, onCollapse]);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    "fixed start-0 top-0 h-screen z-40 hidden lg:block transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                <OrganizationSidebarContent collapsed={collapsed} />

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -end-4 top-8 w-8 h-8 rounded-full border bg-background shadow-md z-50 hover:bg-accent"
                    aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    )}
                </Button>
            </aside>
        </>
    );
};
