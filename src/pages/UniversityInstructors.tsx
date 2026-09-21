import { useState } from "react";
import { UniversitySidebar, UniversitySidebarContent } from "@/components/layout/UniversitySidebar";
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

interface UniversityInstructor {
    Id: string;
    FullName: string;
    Email: string;
    Department: string | null;
    ActiveCourses: number | null;
    AvatarUrl?: string | null;
}

const UniversityInstructors = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { data: instructors = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["university-instructors"],
        queryFn: async () => (await api.get<UniversityInstructor[]>("/University/instructors")).data,
    });

    const filteredInstructors = instructors.filter(inst =>
        inst.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inst.Department || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <UniversitySidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">University Instructors</h1>
                            <p className="text-muted-foreground mt-1">Manage global instructor registry and teaching assignments.</p>
                        </div>
                        <Button className="gradient-primary text-white border-0">
                            <Plus className="w-4 h-4 mr-2" />
                            Add New Instructor
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
                            <Button variant="outline">Departments</Button>
                            <Button variant="outline">Active Status</Button>
                        </div>
                    </div>

                    {isError && <div className="text-center py-6 text-destructive">{getApiError(error, "Could not load instructors.")}</div>}

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
                                                        {instructor.AvatarUrl && <AvatarImage src={instructor.AvatarUrl} />}
                                                        <AvatarFallback>{instructor.FullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{instructor.FullName}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                    <Building2 className="w-3 h-3 text-primary" />
                                                    {instructor.Department || "No department"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 space-y-3 bg-muted/20 border-y border-border/40">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <BookOpen className="w-4 h-4" />
                                                    <span>Active Courses</span>
                                                </div>
                                                <span className="font-bold">{instructor.ActiveCourses || 0}</span>
                                            </div>
                                        </div>

                                        <div className="p-4 space-y-2">
                                            <Button variant="ghost" className="w-full text-xs justify-start hover:bg-primary/5 text-muted-foreground hover:text-primary group/link">
                                                <Mail className="w-3.5 h-3.5 mr-2 opacity-50 group-hover/link:opacity-100" />
                                                {instructor.Email}
                                            </Button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" size="sm" className="text-xs h-8">Profile</Button>
                                                <Button variant="secondary" size="sm" className="text-xs h-8">Assigned</Button>
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
                            <h3 className="text-xl font-medium tracking-tight">No Instructors Found</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">We couldn't find any instructors matching your criteria. Try adjusting your search term.</p>
                            <Button variant="outline" className="mt-6" onClick={() => setSearchQuery("")}>Clear Search</Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UniversityInstructors;
