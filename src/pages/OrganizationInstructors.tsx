import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    Users,
    Mail,
    Building2,
    BookOpen,
    MoreVertical,
    CheckCircle2,
    Star,
    Loader2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";

interface OrganizationInstructor {
    Id: string;
    FullName: string;
    Email: string;
    Department: string | null;
    ActiveCourses: number | null;
    AvatarUrl?: string | null;
}

const OrganizationInstructors = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber } = useFormatters();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { data: instructors = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-instructors"],
        queryFn: async () => (await api.get<OrganizationInstructor[]>("/Organization/instructors")).data,
    });

    const filteredInstructors = instructors.filter(inst =>
        inst.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inst.Department || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t("instructors.title")}</h1>
                            <p className="text-muted-foreground mt-1">{t("instructors.subtitle")}</p>
                        </div>
                        <Button className="gradient-primary text-white border-0">
                            <Plus className="w-4 h-4 me-2" />
                            {t("instructors.add")}
                        </Button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("instructors.search")}
                                className="ps-10 bg-background/50 border-none ring-1 ring-border/50 focus:ring-primary/30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline">{t("instructors.filterDepartments")}</Button>
                            <Button variant="outline">{t("instructors.filterStatus")}</Button>
                        </div>
                    </div>

                    {isError && <div className="text-center py-6 text-destructive">{getApiError(error, t("instructors.loadFailed"))}</div>}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredInstructors.map((instructor) => (
                                <Card key={instructor.Id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden border-b-4 border-b-primary/0 hover:border-b-primary">
                                    <CardContent className="p-0">
                                        <div className="p-6 pb-4">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="relative">
                                                    <Avatar className="w-16 h-16 border-2 border-primary/10 transition-transform group-hover:scale-105">
                                                        {instructor.AvatarUrl && <AvatarImage src={instructor.AvatarUrl} alt={instructor.FullName} />}
                                                        <AvatarFallback>{instructor.FullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-1 -end-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label={t("instructors.actionsMenu", { name: instructor.FullName })}>
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{instructor.FullName}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                    <Building2 className="w-3 h-3 text-primary" />
                                                    {instructor.Department ?? t("unassigned")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 space-y-3 bg-muted/20 border-y border-border/40">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <BookOpen className="w-4 h-4" />
                                                    <span>{t("instructors.activeCourses")}</span>
                                                </div>
                                                <span className="font-bold">{formatNumber(instructor.ActiveCourses || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="p-4 space-y-2">
                                            <Button variant="ghost" className="w-full text-xs justify-start hover:bg-primary/5 text-muted-foreground hover:text-primary group/link">
                                                <Mail className="w-3.5 h-3.5 me-2 opacity-50 group-hover/link:opacity-100" />
                                                <bdi dir="ltr">{instructor.Email}</bdi>
                                            </Button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" size="sm" className="text-xs h-8">{t("instructors.profile")}</Button>
                                                <Button variant="secondary" size="sm" className="text-xs h-8">{t("instructors.assigned")}</Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredInstructors.length === 0 && (
                        <div className="text-center py-24 bg-card/40 rounded-2xl border border-dashed border-border/50">
                            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-10" />
                            <h3 className="text-xl font-medium tracking-tight">{t("instructors.noneFound")}</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">{t("instructors.noneHint")}</p>
                            <Button variant="outline" className="mt-6" onClick={() => setSearchQuery("")}>{t("common:actions.clear")}</Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default OrganizationInstructors;
