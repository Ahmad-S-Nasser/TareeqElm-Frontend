import { useState, ReactNode } from "react";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

interface InstructorPageLayoutProps {
  children: ReactNode;
}

export const InstructorPageLayout = ({ children }: InstructorPageLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InstructorSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        userRole="Instructor"
        mobileSidebar={<InstructorSidebarContent />}
      />
      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0"
        )}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};
