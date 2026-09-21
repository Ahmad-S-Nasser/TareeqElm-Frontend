import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Crown, GraduationCap, BookOpen, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
    id: "admin" | "organization" | "instructor" | "applicant";
    key: string;
    icon: React.ElementType;
    color: string;
}

// The platform has four fixed roles. Access is enforced by the server per role.
const roles: Role[] = [
    { id: "admin", key: "admin", icon: Crown, color: "text-amber-500 bg-amber-500/10" },
    { id: "organization", key: "organization", icon: Building2, color: "text-primary bg-primary/10" },
    { id: "instructor", key: "instructor", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" },
    { id: "applicant", key: "trainer", icon: GraduationCap, color: "text-sky-500 bg-sky-500/10" },
];

const OrganizationRoles = () => {
    const { t } = useTranslation(["organization", "roles"]);
    return (
        <OrganizationPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    {t('roles.title')}
                </h1>
                <p className="text-muted-foreground mt-1">{t('roles.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map(role => {
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
                                        <p className="text-xs text-muted-foreground">{t(`organization:roles.descriptions.${role.key}`)}</p>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>

            <Card className="border-border/50">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    {t('roles.customNotAvailable')}
                </CardContent>
            </Card>
        </OrganizationPageLayout>
    );
};

export default OrganizationRoles;
