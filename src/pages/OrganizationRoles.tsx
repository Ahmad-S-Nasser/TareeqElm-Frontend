import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, GraduationCap, BookOpen, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { RolesHeader } from "@/components/roles/RolesHeader";
import { RolesManager } from "@/components/roles/RolesManager";
import { permissionKey } from "@/components/roles/rbac";
import type { AppRole } from "@/lib/roles";

const builtIn: { id: AppRole; icon: React.ElementType; color: string }[] = [
    { id: "admin", icon: Crown, color: "text-amber-500 bg-amber-500/10" },
    { id: "organization", icon: Building2, color: "text-primary bg-primary/10" },
    { id: "instructor", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" },
    { id: "applicant", icon: GraduationCap, color: "text-sky-500 bg-sky-500/10" },
];

/** Read-only view for accounts without roles.manage: the built-in roles and what this account can do. */
const ReadOnlyRoles = () => {
    const { t } = useTranslation(["rbac", "roles"]);
    const { user } = useAuth();
    const { permissions } = usePermissions();

    return (
        <>
            <p className="text-sm rounded-lg bg-muted px-4 py-3 text-muted-foreground">{t("rbac:readOnly.banner")}</p>

            <div>
                <h2 className="text-sm font-bold mb-3">{t("rbac:readOnly.builtIn")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {builtIn.map((role) => {
                        const Icon = role.icon;
                        return (
                            <Card key={role.id} className="border-border/50">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", role.color)}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm">{t(`roles:${role.id}.name`)}</CardTitle>
                                            <p className="text-xs text-muted-foreground">{t(`roles:${role.id}.description`)}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-5 space-y-3">
                    <h2 className="text-sm font-bold">
                        {user?.CustomRoleName ? t("rbac:readOnly.yoursCustom", { name: user.CustomRoleName }) : t("rbac:readOnly.yours")}
                    </h2>
                    {permissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("rbac:readOnly.none")}</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {permissions.map((name) => (
                                <li key={name}>
                                    <Badge variant="secondary" className="font-normal gap-1">
                                        <Check className="w-3 h-3" aria-hidden />
                                        {t(`rbac:permission.${permissionKey(name)}`, { defaultValue: name })}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </>
    );
};

const OrganizationRoles = () => {
    const { can } = usePermissions();
    return (
        <OrganizationPageLayout>
            <RolesHeader />
            {can(PERMISSIONS.rolesManage) ? <RolesManager /> : <ReadOnlyRoles />}
        </OrganizationPageLayout>
    );
};

export default OrganizationRoles;
