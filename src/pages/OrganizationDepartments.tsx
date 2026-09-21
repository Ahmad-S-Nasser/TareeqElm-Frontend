import { useState } from "react";
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
    Building2,
    Users,
    BookOpen,
    MoreVertical,
    Trash2,
    ChevronRight,
    Loader2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Department { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }

const OrganizationDepartments = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newDept, setNewDept] = useState({ name: "", head: "" });
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: departments = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<Department[]>("/Departments")).data,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["organization-departments"] });
        queryClient.invalidateQueries({ queryKey: ["organization-stats"] });
        queryClient.invalidateQueries({ queryKey: ["departments"] });
    };

    const addMutation = useMutation({
        mutationFn: async (d: { Name: string; HeadOfDepartment?: string }) => { await api.post("/Departments", d); },
        onSuccess: () => {
            invalidate();
            setIsAddOpen(false);
            setNewDept({ name: "", head: "" });
            toast({ title: "Department created" });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not create department") }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/Departments/${id}`); },
        onSuccess: () => { invalidate(); toast({ title: "Department deleted" }); },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not delete department") }),
    });

    const handleAdd = () => {
        if (!newDept.name.trim()) {
            toast({ variant: "destructive", title: "Department name is required" });
            return;
        }
        addMutation.mutate({ Name: newDept.name.trim(), HeadOfDepartment: newDept.head.trim() || undefined });
    };

    const filteredDepartments = departments.filter(dept =>
        dept.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.Head?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
                            <p className="text-muted-foreground mt-1">Manage organization departments and their heads.</p>
                        </div>
                        <Button className="gradient-primary text-white border-0" onClick={() => setIsAddOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Department
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search departments or heads..."
                                className="pl-10 bg-background/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="shrink-0">
                            Filters
                        </Button>
                    </div>

                    {isError && (
                        <div className="text-center py-6 text-destructive">{getApiError(error, "Could not load departments.")}</div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredDepartments.map((dept) => (
                                <Card key={dept.Id} className="group hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden">
                                    <CardHeader className="pb-4 relative">
                                        <div className="flex items-start justify-between">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Delete ${dept.Name}?`)) deleteMutation.mutate(dept.Id); }}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-xl">{dept.Name}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            Head: {dept.Head || "Not Assigned"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Courses</p>
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-primary" />
                                                    <span className="font-bold">{dept.CoursesCount || 0}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Trainers</p>
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-accent" />
                                                    <span className="font-bold">{dept.TrainersCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span className="text-muted-foreground">Performance Score</span>
                                                <span className="text-primary">{dept.Performance || 0}%</span>
                                            </div>
                                            <Progress value={dept.Performance || 0} className="h-1.5" />
                                        </div>

                                        <Button variant="ghost" className="w-full group/btn hover:bg-primary/5 hover:text-primary border border-transparent hover:border-primary/20">
                                            View Department Details
                                            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredDepartments.length === 0 && (
                        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
                            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">No Departments Found</h3>
                            <p className="text-muted-foreground">Try adjusting your search or add a new department.</p>
                        </div>
                    )}
                </div>
            </main>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Department</DialogTitle>
                        <DialogDescription>Create a new department under the organization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="dept-name">Department Name</Label>
                            <Input id="dept-name" placeholder="e.g. Mathematics" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dept-head">Head of Department</Label>
                            <Input id="dept-head" placeholder="e.g. Dr. John Nash" value={newDept.head} onChange={(e) => setNewDept({ ...newDept, head: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={addMutation.isPending} className="gradient-primary text-white border-0">
                            {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Department
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationDepartments;