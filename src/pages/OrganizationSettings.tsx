import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PlatformSettingsForm } from "@/components/settings/PlatformSettingsForm";
import { NotificationPreferencesCard } from "@/components/settings/NotificationPreferencesCard";
import { BillingProfileForm } from "@/components/settings/BillingProfileForm";
import { JoinCodeCard } from "@/components/settings/JoinCodeCard";

const OrganizationSettings = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t } = useTranslation("organization");
    const { can } = usePermissions();
    const canManage = can(PERMISSIONS.settingsManage);
    const canViewOrganization = can(PERMISSIONS.organizationView);

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Organization"
                mobileSidebar={<OrganizationSidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            <Settings className="w-8 h-8 text-primary" />
                            {t("settings.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t("settings.subtitle")}
                        </p>
                    </div>

                    <Tabs defaultValue="general" className="w-full animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <TabsList className="grid w-full grid-cols-2 lg:w-[300px] bg-card border border-border/50 shadow-sm p-1 rounded-xl mb-6">
                            <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("settings.tabs.general")}</TabsTrigger>
                            <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("settings.tabs.notifications")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-6">
                            <PlatformSettingsForm ns="organization" canManage={canManage} />
                            <JoinCodeCard canManage={canManage} />
                            {/* The organization's own seller details for invoices (GET needs organization.view, PUT settings.manage). */}
                            {canViewOrganization && <BillingProfileForm canManage={canManage} />}
                        </TabsContent>

                        <TabsContent value="notifications">
                            <NotificationPreferencesCard />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default OrganizationSettings;
