import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  ChevronLeft,
  Sparkles,
  CalendarClock,
  Upload,
  FileEdit,
  ListTree,
  ClipboardList,
  FileQuestion,
  MessageSquare,
  Megaphone,
  Layers,
  Trophy,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import logo from "@/assets/logo.png";

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  href: string;
  badge?: string;
  /** The item is hidden unless the signed-in user holds it (routes still use the base role). */
  permission?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/instructor" },
  { icon: BookOpen, labelKey: "myCourses", href: "/instructor/courses" },
  { icon: Upload, labelKey: "createCourse", href: "/instructor/create-course" },
  { icon: ListTree, labelKey: "curriculum", href: "/instructor/curriculum" },
  { icon: Users, labelKey: "trainers", href: "/instructor/trainers" },
  { icon: ClipboardList, labelKey: "assignments", href: "/instructor/assignments" },
  { icon: CalendarClock, labelKey: "sessions", href: "/instructor/sessions", permission: PERMISSIONS.sessionsManage },
  { icon: FileQuestion, labelKey: "quizzesExams", href: "/instructor/quizzes" },
  { icon: MessageSquare, labelKey: "discussions", href: "/instructor/discussions" },
  { icon: Megaphone, labelKey: "announcements", href: "/instructor/announcements" },
  { icon: Layers, labelKey: "flashcards", href: "/instructor/flashcards" },
  { icon: BarChart3, labelKey: "analytics", href: "/instructor/analytics" },
  { icon: Trophy, labelKey: "leaderboard", href: "/instructor/leaderboard" },
  // Read-only revenue. There is no pricing control here or anywhere else on an instructor surface: pricing authority
  // belongs to Organization/Admin (`pricing.manage`), the instructor only ever sees what they earned.
  { icon: Wallet, labelKey: "earnings", href: "/instructor/earnings", permission: PERMISSIONS.earningsSelf },
  { icon: FileEdit, labelKey: "contentTools", href: "/instructor/content" },
  { icon: Sparkles, labelKey: "aiAssistant", href: "/instructor/ai-tools" },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onItemClick?: () => void;
  className?: string;
}

export const InstructorSidebarContent = ({ collapsed, onItemClick, className }: SidebarContentProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("nav");
  const { can } = usePermissions();

  const handleNavigate = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  return (
    <div className={cn("flex flex-col h-full bg-card", className)}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
          <img src={logo} alt="" className="w-10 h-10 object-contain" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in text-start">
            <h1 className="font-extrabold text-lg text-black">{t("sidebar.brand.applicant")}</h1>
            <p className="text-xs text-muted-foreground">{t("sidebar.portal.instructor")}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter((item) => !item.permission || can(item.permission)).map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                isActive
                  ? "bg-accent text-white shadow-soft"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform",
                !isActive && "group-hover:scale-110"
              )} />
              {!collapsed && (
                <span className="flex-1 text-start text-sm font-medium animate-fade-in">
                  {t(`sidebar.instructor.${item.labelKey}`)}
                </span>
              )}
              {!collapsed && item.badge && (
                <span className={cn(
                  "px-2 py-0.5 text-xs rounded-full animate-fade-in",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-accent/10 text-accent"
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 space-y-1">
        {!collapsed && <LanguageSwitcher className="mt-2 lg:hidden" />}
      </div>
    </div>
  );
};

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export const InstructorSidebar = ({ onCollapse }: SidebarProps) => {
  const { t } = useTranslation("nav");
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    onCollapse?.(newState);
  };

  return (
    <aside className={cn(
      "fixed start-0 top-0 h-screen bg-card border-e border-border/50 shadow-soft z-40 transition-all duration-300 flex-col hidden lg:flex",
      collapsed ? "w-20" : "w-64"
    )}>
      <InstructorSidebarContent collapsed={collapsed} />

      {/* Collapse Button */}
      <div className="p-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
          className="w-full justify-center"
        >
          <ChevronLeft className={cn(
            "w-4 h-4 transition-transform",
            collapsed ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180"
          )} />
        </Button>
      </div>
    </aside>
  );
};
