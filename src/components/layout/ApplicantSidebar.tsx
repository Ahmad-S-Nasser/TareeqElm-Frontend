import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  FileQuestion,
  ClipboardCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  Sparkles,
  GraduationCap,
  LogOut,
  CalendarDays,
  RotateCcw,
  Award,
  Bell,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/dashboard" },
  { icon: BookOpen, labelKey: "browseCourses", href: "/catalog" },
  { icon: GraduationCap, labelKey: "myCourses", href: "/courses" },
  { icon: Brain, labelKey: "flashcards", href: "/flashcards" },
  { icon: ClipboardCheck, labelKey: "quizzes", href: "/quizzes" },
  { icon: FileQuestion, labelKey: "mockExams", href: "/mock-exam" },
  { icon: BarChart3, labelKey: "analytics", href: "/analytics" },
  { icon: Sparkles, labelKey: "aiTutor", href: "/ai-tutor" },
  { icon: Brain, labelKey: "aiCoach", href: "/ai-coach" },
  { icon: CalendarDays, labelKey: "timeBlocking", href: "/time-blocking" },
  { icon: RotateCcw, labelKey: "spacedRepetition", href: "/spaced-repetition" },
  { icon: Award, labelKey: "achievements", href: "/achievements" },
  { icon: User, labelKey: "myProfile", href: "/profile" },
  { icon: Bell, labelKey: "notifications", href: "/notifications" },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onItemClick?: () => void;
  className?: string;
}

export const ApplicantSidebarContent = ({ collapsed, onItemClick, className }: SidebarContentProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("nav");
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  return (
    <div className={cn("flex flex-col h-full bg-card", className)}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow-primary">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in text-start">
            <h1 className="font-bold text-lg">{t("sidebar.brand.applicant")}</h1>
            <p className="text-xs text-muted-foreground">{t("sidebar.portal.applicant")}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform",
                !isActive && "group-hover:scale-110"
              )} />
              {!collapsed && (
                <span className="flex-1 text-start text-sm font-medium animate-fade-in">
                  {t(`sidebar.applicant.${item.labelKey}`)}
                </span>
              )}
              {!collapsed && item.badge && (
                <span className={cn(
                  "px-2 py-0.5 text-xs rounded-full animate-fade-in",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary"
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
        <button
          onClick={() => handleNavigate("/settings")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-start text-sm font-medium animate-fade-in">
              {t("sidebar.applicant.settings")}
            </span>
          )}
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-start text-sm font-medium animate-fade-in">
              {t("sidebar.signOut")}
            </span>
          )}
        </button>
        {!collapsed && <LanguageSwitcher className="mt-2 lg:hidden" />}
      </div>
    </div>
  );
};

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export const ApplicantSidebar = ({ onCollapse }: SidebarProps) => {
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
      <ApplicantSidebarContent collapsed={collapsed} />

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
