import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { FileQuestion, Plus, Sparkles, Clock, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCourses } from "@/hooks/useCourses";
import api, { getApiError } from "@/lib/api";

interface GeneratedQuestion {
  QuestionText: string;
  Options: string[];
  CorrectOptionIndex: number;
  Points: number;
  Explanation?: string | null;
}

interface GenerateQuizResponse {
  Questions: GeneratedQuestion[];
  Generator: string;
}

interface QuizWithMeta {
  Id: string;
  CourseId: string;
  CourseTitle: string | null;
  Title: string;
  QuestionCount: number;
  PassingScore: number | null;
  TimeLimitMinutes: number | null;
  CreatedAt: string;
}

interface QuizResult {
  Id: string;
  TrainerName: string;
  Score: number;
  TotalPoints: number;
  Percentage: number;
  Passed: boolean;
  TakenAt: string;
}

const InstructorQuizzes = () => {
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [material, setMaterial] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [generator, setGenerator] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [resultsQuiz, setResultsQuiz] = useState<QuizWithMeta | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { courses, fetchInstructorCourses } = useCourses();

  useEffect(() => { fetchInstructorCourses(); }, [fetchInstructorCourses]);

  const { data: quizzes = [], isLoading: loading, error: quizzesError } = useQuery({
    queryKey: ["instructor-quizzes"],
    queryFn: async () => (await api.get<QuizWithMeta[]>("/Quizzes")).data ?? [],
  });

  const { data: results = [], isLoading: resultsLoading, error: resultsError } = useQuery({
    queryKey: ["quiz-results", resultsQuiz?.Id],
    queryFn: async () => (await api.get<QuizResult[]>(`/Quizzes/${resultsQuiz!.Id}/results`)).data ?? [],
    enabled: !!resultsQuiz,
  });

  const generateMutation = useMutation({
    mutationFn: async () =>
      (await api.post<GenerateQuizResponse>("/Quizzes/generate", { CourseMaterial: material, NumQuestions: numQuestions })).data,
    onSuccess: (data) => {
      setGenerated(data.Questions || []);
      setGenerator(data.Generator);
      toast({ title: "Questions ready", description: `${(data.Questions || []).length} suggested questions. Review them before saving.` });
    },
    onError: (e) => toast({ title: "Generation Failed", description: getApiError(e), variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.post("/Quizzes", {
        CourseId: selectedCourseId,
        Title: quizTitle,
        PassingScore: 70,
        Questions: generated.map((q) => ({
          QuestionText: q.QuestionText,
          Options: q.Options,
          CorrectOptionIndex: q.CorrectOptionIndex,
          Points: q.Points,
          Explanation: q.Explanation || undefined,
        })),
      }),
    onSuccess: () => {
      toast({ title: "Quiz Saved!", description: `"${quizTitle}" with ${generated.length} questions.` });
      setAiDialogOpen(false);
      setGenerated([]);
      setGenerator(null);
      setMaterial("");
      setQuizTitle("");
      queryClient.invalidateQueries({ queryKey: ["instructor-quizzes"] });
    },
    onError: (e) => toast({ title: "Save Failed", description: getApiError(e), variant: "destructive" }),
  });

  const generating = generateMutation.isPending;
  const saving = saveMutation.isPending;

  const handleGenerate = () => {
    if (material.trim().length < 20) {
      toast({ title: "Provide course material", description: "Paste at least 20 characters of material.", variant: "destructive" });
      return;
    }
    setGenerated([]);
    generateMutation.mutate();
  };

  const handleSaveQuiz = () => {
    if (!selectedCourseId || !quizTitle || generated.length === 0) {
      toast({ title: "Fill all fields", description: "Select course, title, and generate questions first.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <FileQuestion className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Quizzes & Exams</h1>
            </div>
            <p className="text-muted-foreground">Create, schedule, and review assessments</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate Quiz
            </Button>
            <Button className="gradient-accent text-white shadow-glow-accent" onClick={() => setAiDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Quiz
            </Button>
          </div>
        </div>
      </section>

      {/* Quiz list */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : quizzesError ? (
          <div className="col-span-full text-center py-12">
            <p className="text-destructive">{getApiError(quizzesError, "Failed to load quizzes.")}</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileQuestion className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No quizzes yet. Create one or generate suggested questions from your material.</p>
          </div>
        ) : (
          quizzes.map((q) => (
            <Card key={q.Id} className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => setResultsQuiz(q)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Quiz</Badge>
                  {q.TimeLimitMinutes && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {q.TimeLimitMinutes}m
                    </div>
                  )}
                </div>
                <CardTitle className="text-sm mt-2">{q.Title}</CardTitle>
                <CardDescription className="text-xs">{q.CourseTitle || "—"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{q.QuestionCount} questions</span>
                  {q.PassingScore != null && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Pass: {q.PassingScore}%</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* AI Generate Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Quiz Generator</DialogTitle>
            <DialogDescription>Paste course material to get suggested quiz questions. Review them before saving.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Course</label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Quiz Title</label>
              <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="e.g. Chapter 3 Quiz" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Course Material</label>
              <Textarea value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Paste lecture notes, textbook content, or lesson summaries here…" rows={6} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Number of Questions</label>
              <Select value={String(numQuestions)} onValueChange={(v) => setNumQuestions(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full gradient-accent text-white">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {generating ? "Generating…" : "Generate Questions"}
            </Button>

            {generated.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold">Suggested Questions ({generated.length}){generator === "template" ? " - built from templates" : ""}</h3>
                {generated.map((q, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">Q{i + 1}. {q.QuestionText}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {q.Options.map((opt, j) => (
                          <div key={j} className={`text-xs px-2 py-1 rounded ${j === q.CorrectOptionIndex ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground"}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Points: {q.Points} | Correct: {q.Options[q.CorrectOptionIndex]}</p>
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={handleSaveQuiz} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Save Quiz to Course
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={!!resultsQuiz} onOpenChange={(open) => !open && setResultsQuiz(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{resultsQuiz?.Title} - Results</DialogTitle>
            <DialogDescription>{resultsQuiz?.CourseTitle}</DialogDescription>
          </DialogHeader>
          {resultsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : resultsError ? (
            <p className="text-sm text-destructive text-center py-6">{getApiError(resultsError, "Failed to load results.")}</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No trainer has taken this quiz yet.</p>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.Id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{r.TrainerName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.TakenAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{Math.round(r.Percentage)}% ({r.Score}/{r.TotalPoints})</span>
                    <Badge variant={r.Passed ? "default" : "destructive"}>{r.Passed ? "Passed" : "Failed"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </InstructorPageLayout>
  );
};

export default InstructorQuizzes;
