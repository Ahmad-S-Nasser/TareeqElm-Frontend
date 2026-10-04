import {
    LayoutDashboard,
    Users,
    BookOpen,
    Menu,
    ChevronLeft,
    ChevronRight,
    BarChart2,
    ListChecks,
    ShieldCheck,
    TrendingUp,
    Tag,
    Receipt,
    Ticket,
    Banknote,
    Handshake,
    FileClock,
    Building,
    Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import logo from "@/assets/logo.png";

interface SidebarProps {
    onCollapse?: (collapsed: boolean) => void;
}

// `permission`: the item is hidden unless the signed-in user holds it (routes still use the base role).
const menuItems: { icon: typeof Users; labelKey: string; path: string; permission?: string }[] = [
    { icon: LayoutDashboard, labelKey: "dashboard", path: "/admin" },
    { icon: Users, labelKey: "users", path: "/admin/users", permission: PERMISSIONS.usersManage },
    { icon: BookOpen, labelKey: "courses", path: "/admin/courses" },
    { icon: ListChecks, labelKey: "enrollments", path: "/admin/enrollments", permission: PERMISSIONS.enrollmentsManage },
    { icon: BarChart2, labelKey: "analytics", path: "/admin/analytics", permission: PERMISSIONS.adminStats },
    // Mirrors the Organization entry (same icon, same permission): one shared "Catalog & pricing" body, two shells.
    { icon: Tag, labelKey: "catalogPricing", path: "/admin/catalog", permission: PERMISSIONS.pricingManage },
    { icon: TrendingUp, labelKey: "revenue", path: "/admin/revenue", permission: PERMISSIONS.revenueView },
    { icon: Receipt, labelKey: "orders", path: "/admin/orders", permission: PERMISSIONS.ordersManage },
    { icon: Undo2, labelKey: "refundRequests", path: "/admin/refund-requests", permission: PERMISSIONS.refundRequestsManage },
    { icon: Ticket, labelKey: "coupons", path: "/admin/coupons", permission: PERMISSIONS.couponsManage },
    { icon: Banknote, labelKey: "payouts", path: "/admin/payouts", permission: PERMISSIONS.payoutsManage },
    { icon: Handshake, labelKey: "leads", path: "/admin/leads", permission: PERMISSIONS.leadsManage },
    { icon: Building, labelKey: "organizations", path: "/admin/organizations", permission: PERMISSIONS.organizationsManage },
    { icon: ShieldCheck, labelKey: "roles", path: "/admin/roles", permission: PERMISSIONS.rolesManage },
    { icon: FileClock, labelKey: "audit", path: "/admin/audit", permission: PERMISSIONS.auditView },
];

export const AdminSidebarContent = ({ collapsed }: { collapsed: boolean }) => {
    const location = useLocation();
    const { t } = useTranslation("nav");
    const { can } = usePermissions();

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-e border-border/50">
            <div className={cn(
                "p-6 flex items-center gap-3",
                collapsed ? "justify-center px-2" : ""
            )}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                    <img src={logo} alt="" className="w-8 h-8 object-contain" />
                </div>
                {!collapsed && (
                    <span className="font-extrabold text-lg text-black">
                        {t("sidebar.brand.admin")}
                    </span>
                )}
            </div>

            <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto scrollbar-none">
                {menuItems.filter((item) => !item.permission || can(item.permission)).map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.path === "/admin"
                            ? location.pathname === "/admin"
                            : location.pathname.startsWith(item.path);

                    return (
                        <Link to={item.path} key={item.path}>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-3 transition-all duration-300",
                                    isActive && "bg-warning/10 text-warning hover:bg-warning/20",
                                    collapsed ? "justify-center px-2" : "px-4"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", isActive && "text-warning")} />
                                {!collapsed && <span>{t(`sidebar.admin.${item.labelKey}`)}</span>}
                            </Button>
                        </Link>
                    );
                })}
            </div>

            <div className="p-4 border-t border-border/50">
                {!collapsed && <LanguageSwitcher className="lg:hidden" />}
            </div>
        </div>
    );
};

export const AdminSidebar = ({ onCollapse }: SidebarProps) => {
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
                <AdminSidebarContent collapsed={collapsed} />

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
