import { useState } from "react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PlatformSettingsForm } from "@/components/settings/PlatformSettingsForm";
import { NotificationPreferencesCard } from "@/components/settings/NotificationPreferencesCard";

const AdminSettings = () => {
    const { t } = useTranslation("admin");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { can } = usePermissions();
    const canManage = can(PERMISSIONS.settingsManage);

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-black">{t("settings.title")}</h1>
                        <p className="text-muted-foreground text-sm mt-1">{t("settings.subtitle")}</p>
                    </div>

                    <PlatformSettingsForm ns="admin" canManage={canManage} />

                    <NotificationPreferencesCard />
                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
