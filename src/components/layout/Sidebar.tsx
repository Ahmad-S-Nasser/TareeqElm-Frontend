import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  FileQuestion,
  BarChart3,
  Settings,
  ChevronLeft,
  Sparkles,
  GraduationCap,
  Upload
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/" },
  { icon: BookOpen, labelKey: "myCourses", href: "/courses", badge: "3" },
  { icon: Upload, labelKey: "uploadSyllabus", href: "/syllabus-upload" },
  { icon: Brain, labelKey: "flashcards", href: "/flashcards" },
  { icon: FileQuestion, labelKey: "mockExams", href: "/mock-exam" },
  { icon: BarChart3, labelKey: "progress", href: "/progress" },
  { icon: Sparkles, labelKey: "aiTutor", href: "/ai-tutor" },
  { icon: BarChart3, labelKey: "instructorView", href: "/instructor" },
];

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export const Sidebar = ({ onCollapse }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("nav");

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    onCollapse?.(newState);
  };

  return (
    <aside className={cn(
      "fixed start-0 top-0 h-screen bg-card border-e border-border/50 shadow-soft z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow-primary">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-bold text-lg">{t("sidebar.brand.applicant")}</h1>
            <p className="text-xs text-muted-foreground">{t("sidebar.portal.generic")}</p>
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
              onClick={() => navigate(item.href)}
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
      <div className="p-3 border-t border-border/50">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-start text-sm font-medium animate-fade-in">
              {t("sidebar.applicant.settings")}
            </span>
          )}
        </button>

        {/* Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
          className="w-full mt-2 justify-center"
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
