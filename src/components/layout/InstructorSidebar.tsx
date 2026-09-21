import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  Sparkles,
  GraduationCap,
  LogOut,
  Upload,
  FileEdit,
  Bell,
  ListTree,
  ClipboardList,
  FileQuestion,
  MessageSquare,
  Megaphone,
  Layers,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/instructor" },
  { icon: BookOpen, label: "My Courses", href: "/instructor/courses" },
  { icon: Upload, label: "Create Course", href: "/instructor/create-course" },
  { icon: ListTree, label: "Curriculum", href: "/instructor/curriculum" },
  { icon: Users, label: "Trainers", href: "/instructor/trainers" },
  { icon: ClipboardList, label: "Assignments", href: "/instructor/assignments" },
  { icon: FileQuestion, label: "Quizzes & Exams", href: "/instructor/quizzes" },
  { icon: MessageSquare, label: "Discussions", href: "/instructor/discussions" },
  { icon: Megaphone, label: "Announcements", href: "/instructor/announcements" },
  { icon: Layers, label: "Flashcards", href: "/instructor/flashcards" },
  { icon: BarChart3, label: "Analytics", href: "/instructor/analytics" },
  { icon: Trophy, label: "Leaderboard", href: "/instructor/leaderboard" },
  { icon: FileEdit, label: "Content Tools", href: "/instructor/content" },
  { icon: Sparkles, label: "AI Assistant", href: "/instructor/ai-tools" },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onItemClick?: () => void;
  className?: string;
}

export const InstructorSidebarContent = ({ collapsed, onItemClick, className }: SidebarContentProps) => {
  const navigate = useNavigate();
  const location = useLocation();
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
        <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center flex-shrink-0 shadow-glow-accent">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in text-left">
            <h1 className="font-bold text-lg">TareeqElm</h1>
            <p className="text-xs text-muted-foreground">Instructor Portal</p>
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
                  ? "bg-accent text-white shadow-soft"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform",
                !isActive && "group-hover:scale-110"
              )} />
              {!collapsed && (
                <span className="flex-1 text-left text-sm font-medium animate-fade-in">
                  {item.label}
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
        <button
          onClick={() => handleNavigate("/instructor/notifications")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left text-sm font-medium animate-fade-in">
              Notifications
            </span>
          )}
        </button>
        <button
          onClick={() => handleNavigate("/instructor/settings")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left text-sm font-medium animate-fade-in">
              Settings
            </span>
          )}
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left text-sm font-medium animate-fade-in">
              Sign Out
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export const InstructorSidebar = ({ onCollapse }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    onCollapse?.(newState);
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-card border-r border-border/50 shadow-soft z-40 transition-all duration-300 flex-col hidden lg:flex",
      collapsed ? "w-20" : "w-64"
    )}>
      <InstructorSidebarContent collapsed={collapsed} />

      {/* Collapse Button */}
      <div className="p-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="w-full justify-center"
        >
          <ChevronLeft className={cn(
            "w-4 h-4 transition-transform",
            collapsed && "rotate-180"
          )} />
        </Button>
      </div>
    </aside>
  );
};
