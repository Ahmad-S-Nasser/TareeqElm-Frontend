import { useState } from "react";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Search,
    Plus,
    Users,
    Mail,
    Building2,
    GraduationCap,
    MoreVertical,
    CheckCircle2,
    Clock,
    TrendingUp,
    Loader2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";

interface OrganizationTrainer {
    Id: string;
    FullName: string;
    Email: string;
    Department: string | null;
    Progress: number | null;
    AvatarUrl?: string | null;
}

const OrganizationTrainers = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { data: trainers = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-trainers"],
        queryFn: async () => (await api.get<OrganizationTrainer[]>("/Organization/trainers")).data,
    });

    const filteredTrainers = trainers.filter(trainer =>
        trainer.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trainer.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trainer.Department || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Organization Trainers</h1>
                            <p className="text-muted-foreground mt-1">Global trainer registry and organizational performance tracking.</p>
                        </div>
                        <Button className="gradient-primary text-white border-0">
                            <Plus className="w-4 h-4 mr-2" />
                            Enroll New Trainer
                        </Button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email or department..."
                                className="pl-10 bg-background/50 border-none ring-1 ring-border/50 focus:ring-primary/30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline">Year</Button>
                            <Button variant="outline">Status</Button>
                        </div>
                    </div>

                    {isError && <div className="text-center py-6 text-destructive">{getApiError(error, "Could not load trainers.")}</div>}

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
                                                        {trainer.AvatarUrl && <AvatarImage src={trainer.AvatarUrl} />}
                                                        <AvatarFallback>{trainer.FullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] py-0">Active</Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{trainer.FullName}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                    <Building2 className="w-3 h-3 text-primary" />
                                                    {trainer.Department || "No department"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 space-y-3 bg-muted/20 border-y border-border/40">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    <span>Academic Progress</span>
                                                    <span className="text-primary">{trainer.Progress?.toFixed(0) || 0}%</span>
                                                </div>
                                                <Progress value={trainer.Progress || 0} className="h-1.5" />
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                    <Mail className="w-3.5 h-3.5 opacity-60" />
                                                    {trainer.Email}
                                                </div>
                                            </div>
                                            <Button variant="outline" className="w-full text-xs hover:bg-primary/5 hover:text-primary border-border/50 group/btn">
                                                View Academic Profile
                                                <TrendingUp className="w-3.5 h-3.5 ml-2 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
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
                            <h3 className="text-xl font-medium tracking-tight">No Trainers Found</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">We couldn't find any trainers matching your criteria. Try adjusting your search term.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default OrganizationTrainers;