import {
    LayoutDashboard,
    Users,
    Building2,
    BookOpen,
    Menu,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    PieChart,
    Calendar,
    CalendarClock,
    Layers,
    UserCheck,
    ClipboardList,
    Megaphone,
    FolderOpen,
    FileBarChart,
    Brain,
    ShieldCheck,
    Tag,
    TrendingUp,
    Warehouse,
    CalendarRange,
    School,
    Receipt,
    Undo2,
    UserPlus,
    Ticket,
    Banknote,
    Store,
    CreditCard,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useOrganizationProfile } from "@/hooks/useOrganization";
import logo from "@/assets/logo.png";

interface SidebarProps {
    onCollapse?: (collapsed: boolean) => void;
}

// `permission`: the item is hidden unless the signed-in user holds it (routes still use the base role).
// `schoolOnly`: the item is hidden unless the caller's organization is School-kind (academic years and grades).
const menuItems: { icon: typeof Users; labelKey: string; path: string; permission?: string; schoolOnly?: boolean }[] = [
    { icon: LayoutDashboard, labelKey: "overview", path: "/organization" },
    { icon: Building2, labelKey: "departments", path: "/organization/departments", permission: PERMISSIONS.departmentsManage },
    { icon: Warehouse, labelKey: "facilities", path: "/organization/facilities", permission: PERMISSIONS.facilitiesManage },
    { icon: CalendarRange, labelKey: "academicYears", path: "/organization/academic-years", schoolOnly: true },
    { icon: Calendar, labelKey: "academicTerms", path: "/organization/terms", permission: PERMISSIONS.termsManage },
    { icon: School, labelKey: "grades", path: "/organization/grades", schoolOnly: true },
    { icon: CalendarClock, labelKey: "calendar", path: "/organization/calendar", permission: PERMISSIONS.sessionsManage },
    { icon: Layers, labelKey: "sections", path: "/organization/sections", permission: PERMISSIONS.sectionsManage },
    { icon: Users, labelKey: "instructors", path: "/organization/instructors", permission: PERMISSIONS.instructorsView },
    { icon: GraduationCap, labelKey: "trainers", path: "/organization/trainers" },
    { icon: BookOpen, labelKey: "courses", path: "/organization/courses" },
    // Catalog v12 phase 3: browse/license the platform's own courses. Open to any Organization caller — the actual
    // purchase is gated at checkout, same as a trainee's own buy flow.
    { icon: Store, labelKey: "platformCourses", path: "/organization/platform-courses" },
    // Catalog v12 phase 4: the org's own trainee seat cap/usage and self-service packages. Open to any Organization
    // caller, same reasoning as platformCourses above — the purchase itself is gated at checkout.
    { icon: CreditCard, labelKey: "billing", path: "/organization/billing" },
    { icon: Tag, labelKey: "catalogPricing", path: "/organization/catalog", permission: PERMISSIONS.pricingManage },
    { icon: UserCheck, labelKey: "enrollment", path: "/organization/enrollment", permission: PERMISSIONS.enrollmentsManage },
    { icon: ClipboardList, labelKey: "exams", path: "/organization/exams", permission: PERMISSIONS.examsView },
    { icon: Megaphone, labelKey: "announcements", path: "/organization/announcements", permission: PERMISSIONS.announcementsManage },
    { icon: FolderOpen, labelKey: "contentLibrary", path: "/organization/content", permission: PERMISSIONS.contentView },
    { icon: PieChart, labelKey: "analytics", path: "/organization/analytics", permission: PERMISSIONS.organizationView },
    { icon: TrendingUp, labelKey: "revenue", path: "/organization/revenue", permission: PERMISSIONS.revenueView },
    // Mirrors the Admin entries (same icons, same permissions): one shared Orders/Coupons/Payouts body each, two shells.
    { icon: Receipt, labelKey: "orders", path: "/organization/orders", permission: PERMISSIONS.ordersManage },
    { icon: Receipt, labelKey: "invoices", path: "/organization/invoices", permission: PERMISSIONS.invoicesView },
    { icon: Undo2, labelKey: "refundRequests", path: "/organization/refund-requests", permission: PERMISSIONS.refundRequestsManage },
    { icon: Ticket, labelKey: "coupons", path: "/organization/coupons", permission: PERMISSIONS.couponsManage },
    { icon: Banknote, labelKey: "payouts", path: "/organization/payouts", permission: PERMISSIONS.payoutsManage },
    { icon: UserPlus, labelKey: "pendingMembers", path: "/organization/pending-members", permission: PERMISSIONS.pendingMembersManage },
    { icon: FileBarChart, labelKey: "reports", path: "/organization/reports" },
    { icon: Brain, labelKey: "aiInsights", path: "/organization/ai-insights" },
    { icon: ShieldCheck, labelKey: "rolesPermissions", path: "/organization/roles" },
];

export const OrganizationSidebarContent = ({ collapsed }: { collapsed: boolean }) => {
    const location = useLocation();
    const { t } = useTranslation("nav");
    const { can } = usePermissions();
    const { isSchool } = useOrganizationProfile();

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
                        {t("sidebar.brand.organization")}
                    </span>
                )}
            </div>

            <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-none">
                {menuItems.filter((item) => (!item.permission || can(item.permission)) && (!item.schoolOnly || isSchool)).map((item) => {
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
                {!collapsed && <LanguageSwitcher className="lg:hidden" />}
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
