import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { Chapter } from "@/hooks/useCourseEditor";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { ListTree, BookOpen, GripVertical, Plus, Loader2, ChevronDown, ChevronRight, Video, FileText, HelpCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCourses } from "@/hooks/useCourses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const typeIcons: Record<string, React.ElementType> = {
  video: Video,
  reading: FileText,
  quiz: HelpCircle,
  assignment: Pencil,
  interactive: Pencil,
};

const InstructorCurriculum = () => {
  const { courses, fetchInstructorCourses } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => { fetchInstructorCourses(); }, [fetchInstructorCourses]);

  const { data: sections = [], isLoading, error } = useQuery({
    queryKey: ["curriculum", selectedCourse],
    queryFn: async () => (await api.get<Chapter[]>(`/Courses/${selectedCourse}/curriculum`)).data ?? [],
    enabled: !!selectedCourse,
  });

  const toggleSection = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const editCourse = () => selectedCourse && navigate(`/instructor/courses/${selectedCourse}`);

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <ListTree className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Curriculum Manager</h1>
            </div>
            <p className="text-muted-foreground">Organize course content with sections, lessons, and resources</p>
          </div>
          <div className="flex gap-3 items-center">
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                ))}
                {courses.length === 0 && <SelectItem value="none" disabled>No courses</SelectItem>}
              </SelectContent>
            </Select>
            <Button className="gradient-accent text-white shadow-glow-accent" disabled={!selectedCourse} onClick={editCourse}>
              <Plus className="w-4 h-4 mr-2" /> Add Section
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {!selectedCourse ? (
          <p className="text-center text-muted-foreground py-12">Select a course to view its curriculum.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-center text-destructive py-12">{getApiError(error, "Failed to load the curriculum.")}</p>
        ) : sections.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">This course has no sections yet. Use "Add Section" to build the curriculum in the course editor.</p>
        ) : null}
        {sections.map((section) => {
          const expanded = !collapsed[section.Id];
          return (
          <Card key={section.Id} className="shadow-soft border-border/50">
            <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => toggleSection(section.Id)}>
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <CardTitle className="text-sm font-semibold flex-1">{section.Title}</CardTitle>
                <Badge variant="secondary" className="text-xs">{section.Lessons.length} lessons</Badge>
              </div>
            </CardHeader>
            {expanded && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="space-y-2 ml-8">
                  {section.Lessons.map((lesson) => {
                    const TypeIcon = typeIcons[lesson.LessonType.toLowerCase()] || FileText;
                    return (
                      <div key={lesson.Id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
                        <TypeIcon className="w-4 h-4 text-primary" />
                        <span className="text-sm flex-1">{lesson.Title}</span>
                        <Badge variant="outline" className="text-xs capitalize">{lesson.LessonType.toLowerCase()}</Badge>
                        <span className="text-xs text-muted-foreground">{lesson.DurationMinutes ? `${lesson.DurationMinutes} min` : ""}</span>
                      </div>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={editCourse}>
                    <Plus className="w-3 h-3 mr-1" /> Add Lesson
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
          );
        })}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorCurriculum;
