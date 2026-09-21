import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Crown, GraduationCap, BookOpen, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
}

// The platform has four fixed roles. Access is enforced by the server per role.
const roles: Role[] = [
    { name: "Admin", description: "Full access to all platform features, user management and administrative tools", icon: Crown, color: "text-amber-500 bg-amber-500/10" },
    { name: "Organization", description: "Manage departments, terms, sections, announcements and the shared content library", icon: Building2, color: "text-primary bg-primary/10" },
    { name: "Instructor", description: "Create and manage courses and quizzes, and track trainer progress", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" },
    { name: "Trainer", description: "Access courses, take quizzes, and track learning progress", icon: GraduationCap, color: "text-sky-500 bg-sky-500/10" },
];

const OrganizationRoles = () => {
    return (
        <OrganizationPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    Roles & Permissions
                </h1>
                <p className="text-muted-foreground mt-1">The access levels available across the platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map(role => {
                    const Icon = role.icon;
                    return (
                        <Card key={role.name} className="border-border/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", role.color)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm">{role.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{role.description}</p>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>

            <Card className="border-border/50">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Custom roles and per-permission editing are not available yet. Assign roles to users from the admin user management page.
                </CardContent>
            </Card>
        </OrganizationPageLayout>
    );
};

export default OrganizationRoles;
