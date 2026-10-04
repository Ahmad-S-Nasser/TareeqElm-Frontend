import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search,
    Plus,
    Mail,
    Building2,
    GraduationCap,
    TrendingUp,
    Loader2,
    BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { IssueAcademicCertificateDialog } from "@/components/certificates/IssueAcademicCertificateDialog";

interface OrganizationTrainer {
    Id: string;
    FullName: string;
    Email: string;
    Department: string | null;
    DepartmentId: string | null;
    Progress: number | null;
    IsActive: boolean;
    JoinedYear: number;
    AvatarUrl?: string | null;
}
interface DepartmentOption { Id: string; Name: string }
interface TrainerEnrollment { Id: string; CourseId: string; CourseTitle: string | null; Status: string; ProgressPercentage: number }

const ALL = "all";
const NO_DEPARTMENT = "none";

const OrganizationTrainers = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatPercent } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [yearFilter, setYearFilter] = useState(ALL);
    const [statusFilter, setStatusFilter] = useState(ALL);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newTrainer, setNewTrainer] = useState({ fullName: "", email: "", password: "", departmentId: NO_DEPARTMENT });
    const [profileTrainer, setProfileTrainer] = useState<OrganizationTrainer | null>(null);
    const [certificateTrainer, setCertificateTrainer] = useState<OrganizationTrainer | null>(null);

    const { data: trainers = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-trainers"],
        queryFn: async () => (await api.get<OrganizationTrainer[]>("/Organization/trainers")).data,
    });
    const { data: departments = [] } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });
    const { data: enrollments = [], isLoading: profileLoading, isError: profileError } = useQuery({
        queryKey: ["trainer-enrollments", profileTrainer?.Id],
        enabled: !!profileTrainer,
        queryFn: async () => (await api.get<TrainerEnrollment[]>(`/Enrollments/trainer/${profileTrainer!.Id}`)).data,
    });

    const years = useMemo(
        () => Array.from(new Set(trainers.map((tr) => tr.JoinedYear).filter(Boolean))).sort((a, b) => b - a),
        [trainers]
    );

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["organization-trainers"] });

    const createMutation = useMutation({
        mutationFn: async () => {
            await api.post("/admin/users", {
                FullName: newTrainer.fullName.trim(),
                Email: newTrainer.email.trim(),
                Password: newTrainer.password,
                Role: "Trainer",
                DepartmentId: newTrainer.departmentId === NO_DEPARTMENT ? undefined : newTrainer.departmentId,
            });
        },
        onSuccess: () => {
            invalidate();
            setIsAddOpen(false);
            setNewTrainer({ fullName: "", email: "", password: "", departmentId: NO_DEPARTMENT });
            toast({ title: t("trainers.addDialog.created") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("trainers.addDialog.createFailed"), description: getApiError(err, t("trainers.addDialog.createFailed")) }),
    });

    const handleAdd = () => {
        if (!newTrainer.fullName.trim() || !newTrainer.email.trim()) {
            toast({ variant: "destructive", title: t("trainers.addDialog.missingFields") });
            return;
        }
        if (newTrainer.password.length < 8) {
            toast({ variant: "destructive", title: t("trainers.addDialog.passwordShort") });
            return;
        }
        createMutation.mutate();
    };

    const filteredTrainers = trainers.filter(trainer =>
        (trainer.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trainer.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trainer.Department || "").toLowerCase().includes(searchQuery.toLowerCase())) &&
        (yearFilter === ALL || String(trainer.JoinedYear) === yearFilter) &&
        (statusFilter === ALL || trainer.IsActive === (statusFilter === "active"))
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
                            <h1 className="text-3xl font-bold tracking-tight">{t("trainers.title")}</h1>
                            <p className="text-muted-foreground mt-1">{t("trainers.subtitle")}</p>
                        </div>
                        <Can permission={PERMISSIONS.usersManage}>
                            <Button className="gradient-primary text-white border-0" onClick={() => setIsAddOpen(true)}>
                                <Plus className="w-4 h-4 me-2" />
                                {t("trainers.add")}
                            </Button>
                        </Can>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("trainers.search")}
                                className="ps-10 bg-background/50 border-none ring-1 ring-border/50 focus:ring-primary/30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={yearFilter} onValueChange={setYearFilter}>
                                <SelectTrigger className="w-full sm:w-36" aria-label={t("trainers.filterYear")}>
                                    <SelectValue placeholder={t("trainers.filterYear")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("trainers.filterYear")}</SelectItem>
                                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-40" aria-label={t("common:labels.status")}>
                                    <SelectValue placeholder={t("common:labels.status")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("common:labels.status")}</SelectItem>
                                    <SelectItem value="active">{t("trainers.status.active")}</SelectItem>
                                    <SelectItem value="inactive">{t("trainers.status.inactive")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isError && <div className="text-center py-6 text-destructive">{getApiError(error, t("trainers.loadFailed"))}</div>}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredTrainers.map((trainer) => (
                                <Card key={trainer.Id} className="group hover:shadow-xl transition-all duration-300 border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden border-t-4 border-t-primary/0 hover:border-t-primary">
                                    <CardContent className="p-0">
                                        <div className="p-6 pb-4">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="relative">
                                                    <Avatar className="w-16 h-16 border-2 border-primary/10 transition-transform group-hover:rotate-2">
                                                        {trainer.AvatarUrl && <AvatarImage src={trainer.AvatarUrl} alt={trainer.FullName} />}
                                                        <AvatarFallback>{trainer.FullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] py-0",
                                                        trainer.IsActive
                                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                                            : "bg-muted text-muted-foreground border-border"
                                                    )}
                                                >
                                                    {trainer.IsActive ? t("trainers.status.active") : t("trainers.status.inactive")}
                                                </Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{trainer.FullName}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                    <Building2 className="w-3 h-3 text-primary" />
                                                    {trainer.Department ?? t("unassigned")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 space-y-3 bg-muted/20 border-y border-border/40">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    <span>{t("trainers.progress")}</span>
                                                    <span className="text-primary">{formatPercent(Math.round(trainer.Progress || 0))}</span>
                                                </div>
                                                <Progress value={trainer.Progress || 0} className="h-1.5" />
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                    <Mail className="w-3.5 h-3.5 opacity-60" />
                                                    <bdi dir="ltr">{trainer.Email}</bdi>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full text-xs hover:bg-primary/5 hover:text-primary border-border/50 group/btn"
                                                onClick={() => setProfileTrainer(trainer)}
                                            >
                                                {t("trainers.viewProfile")}
                                                <TrendingUp className="w-3.5 h-3.5 ms-2 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredTrainers.length === 0 && (
                        <div className="text-center py-24 bg-card/40 rounded-2xl border border-dashed border-border/50">
                            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-10" />
                            <h3 className="text-xl font-medium tracking-tight">{t("trainers.noneFound")}</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">{t("trainers.noneHint")}</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Enroll trainer */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{t("trainers.addDialog.title")}</DialogTitle>
                        <DialogDescription>{t("trainers.addDialog.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nt-name">{t("trainers.addDialog.fullName")}</Label>
                            <Input id="nt-name" placeholder={t("trainers.addDialog.fullNamePlaceholder")} value={newTrainer.fullName} onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nt-email">{t("trainers.addDialog.email")}</Label>
                            <Input id="nt-email" type="email" placeholder={t("trainers.addDialog.emailPlaceholder")} value={newTrainer.email} onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nt-pass">{t("trainers.addDialog.password")}</Label>
                            <Input id="nt-pass" type="password" placeholder={t("trainers.addDialog.passwordPlaceholder")} value={newTrainer.password} onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("trainers.addDialog.department")}</Label>
                            <Select value={newTrainer.departmentId} onValueChange={(v) => setNewTrainer({ ...newTrainer, departmentId: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_DEPARTMENT}>{t("trainers.addDialog.noDepartment")}</SelectItem>
                                    {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleAdd} disabled={createMutation.isPending} className="gradient-primary text-white border-0">
                            {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("trainers.addDialog.submit")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Academic profile */}
            <Dialog open={!!profileTrainer} onOpenChange={(open) => !open && setProfileTrainer(null)}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>{t("trainers.profileDialog.title", { name: profileTrainer?.FullName ?? "" })}</DialogTitle>
                        <DialogDescription>{profileTrainer?.Email}</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        {profileLoading && (
                            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        )}
                        {profileError && <p className="text-center text-destructive py-6">{t("trainers.profileDialog.loadFailed")}</p>}
                        {!profileLoading && !profileError && enrollments.length === 0 && (
                            <p className="text-center text-muted-foreground py-10">{t("trainers.profileDialog.empty")}</p>
                        )}
                        {!profileLoading && !profileError && enrollments.length > 0 && (
                            <ScrollArea className="max-h-80">
                                <ul className="divide-y divide-border/50">
                                    {enrollments.map((enrollment) => (
                                        <li key={enrollment.Id} className="py-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                                                    <span className="font-medium truncate">{enrollment.CourseTitle ?? t("common:deletedCourse")}</span>
                                                </div>
                                                <Badge variant="outline" className="text-xs shrink-0">{t(`enrollment.status.${enrollment.Status}`, enrollment.Status)}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress value={enrollment.ProgressPercentage} className="h-1.5 flex-1" />
                                                <span dir="ltr" className="text-xs text-muted-foreground w-10 text-end">{formatPercent(Math.round(enrollment.ProgressPercentage))}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        )}
                    </div>
                    <Can permission={PERMISSIONS.certificatesIssue}>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCertificateTrainer(profileTrainer);
                                    setProfileTrainer(null);
                                }}
                            >
                                <BadgeCheck className="w-4 h-4 me-2" />
                                {t("trainers.profileDialog.issueCertificate")}
                            </Button>
                        </DialogFooter>
                    </Can>
                </DialogContent>
            </Dialog>

            {/* Manual academic certificate (certificates.issue) */}
            <IssueAcademicCertificateDialog trainee={certificateTrainer} onClose={() => setCertificateTrainer(null)} />
        </div>
    );
};

export default OrganizationTrainers;
