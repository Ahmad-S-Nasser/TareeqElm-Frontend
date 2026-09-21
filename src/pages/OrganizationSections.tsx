import { useState } from "react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Users, Clock, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api, { getApiError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface Section {
    Id: string;
    SectionLabel: string;
    CourseId: string;
    CourseTitle: string | null;
    InstructorId: string | null;
    InstructorName: string | null;
    TermId: string | null;
    TermName: string | null;
    Capacity: number;
    Schedule: string | null;
}

const OrganizationSections = () => {
    const [search, setSearch] = useState("");

    const { data: sections = [], isLoading, isError, error } = useQuery({
        queryKey: ["course-sections"],
        queryFn: async () => (await api.get<Section[]>("/Sections")).data,
    });

    const filtered = sections.filter((s) =>
        (s.CourseTitle || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.SectionLabel || "").toLowerCase().includes(search.toLowerCase())
    );

    const grouped = filtered.reduce<Record<string, Section[]>>((acc, s) => {
        const name = s.CourseTitle || "Unknown Course";
        (acc[name] ||= []).push(s);
        return acc;
    }, {});

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-primary" />
                        </div>
                        Sections & Classes
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage course sections, instructors, and class schedules</p>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by course or section..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: "Total Sections", value: sections.length, color: "text-primary" },
                    { label: "Total Capacity", value: sections.reduce((sum, c) => sum + c.Capacity, 0), color: "text-emerald-500" },
                    { label: "Courses", value: new Set(sections.map((c) => c.CourseId)).size, color: "text-amber-500" },
                ].map(s => (
                    <Card key={s.label} className="border-border/50">
                        <CardContent className="p-5">
                            <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load sections.")}</CardContent></Card>
            ) : Object.keys(grouped).length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">No sections yet.</CardContent></Card>
            ) : (
                Object.entries(grouped).map(([course, secs]) => (
                    <div key={course} className="space-y-3">
                        <h2 className="text-lg font-bold">{course}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {secs.map((sec) => (
                                <Card key={sec.Id} className="border-border/50 hover:shadow-md transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold">{sec.SectionLabel}</CardTitle>
                                            {sec.TermName && <span className="text-xs text-muted-foreground">{sec.TermName}</span>}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            {sec.Schedule && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{sec.Schedule}</span>}
                                            {sec.InstructorName && <span>{sec.InstructorName}</span>}
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Capacity {sec.Capacity}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </OrganizationPageLayout>
    );
};

export default OrganizationSections;
