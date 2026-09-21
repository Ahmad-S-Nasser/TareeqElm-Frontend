import { useState } from "react";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useInstructorTrainers } from "@/hooks/useInstructorTrainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Loader2, Mail, MoreHorizontal, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { getApiError } from "@/lib/api";

const AllTrainers = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const { trainers, loading, error } = useInstructorTrainers();
    const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null);

    const filteredTrainers = trainers.filter(trainer =>
        trainer.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Instructor"
                mobileSidebar={<InstructorSidebarContent />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">All Trainers</h1>
                            <p className="text-muted-foreground">Manage and view all trainers enrolled in your courses</p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search trainers..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Trainer Directory ({filteredTrainers.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : error ? (
                                <div className="text-center py-12 text-destructive">
                                    <p>{getApiError(error, "Failed to load trainers.")}</p>
                                </div>
                            ) : filteredTrainers.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No trainers found.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Trainer</TableHead>
                                            <TableHead>Enrolled Courses</TableHead>
                                            <TableHead>Avg. Progress</TableHead>
                                            <TableHead>Last Active</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTrainers.map((trainer) => (
                                            <TableRow key={trainer.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={trainer.avatar_url || undefined} />
                                                            <AvatarFallback>{getInitials(trainer.full_name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{trainer.full_name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Mail className="w-3 h-3" />
                                                                {trainer.email || "No email"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                                                        <span>{trainer.enrolledCoursesCount} Courses</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={trainer.totalProgress === 100 ? "default" : "secondary"}>
                                                        {trainer.totalProgress}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {trainer.lastActive ? format(new Date(trainer.lastActive), "MMM d, yyyy") : "Never"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                View Details
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>{trainer.full_name}'s Enrollments</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="space-y-4 pt-4">
                                                                {trainer.courses.map((course) => (
                                                                    <div key={course.id} className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
                                                                        <span className="font-medium">{course.title}</span>
                                                                        <Badge variant="outline">{course.progress}% Completed</Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default AllTrainers;
