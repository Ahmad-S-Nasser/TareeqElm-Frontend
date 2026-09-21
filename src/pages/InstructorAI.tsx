import { useState, useMemo } from "react";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sparkles,
    MessageSquare,
    FileText,
    CheckSquare,
    BarChart,
    Send,
    User,
    Bot,
    Copy,
    RefreshCw,
    Upload,
    Users,
    AlertTriangle,
    TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInstructorTrainers } from "@/hooks/useInstructorTrainers";

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const InstructorAI = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState("chat");
    const { toast } = useToast();
    const { trainers: instructorTrainers, loading: trainersLoading } = useInstructorTrainers();

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am your AI teaching assistant. How can I help you improve your courses today?',
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Tool States
    const [quizTopic, setQuizTopic] = useState("");
    const [quizDifficulty, setQuizDifficulty] = useState("medium");
    const [assignmentMode, setAssignmentMode] = useState<"all" | "select">("all");
    const [selectedTrainers, setSelectedTrainers] = useState<string[]>([]);
    const [quizAttachment, setQuizAttachment] = useState<File | null>(null);
    const [generatedQuiz, setGeneratedQuiz] = useState<string | null>(null);

    const [lessonTopic, setLessonTopic] = useState("");
    const [lessonAttachment, setLessonAttachment] = useState<File | null>(null);
    const [generatedLesson, setGeneratedLesson] = useState<string | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);

    // Insights Calculations
    const insights = useMemo(() => {
        if (!instructorTrainers.length) return null;

        const atRisk = instructorTrainers.filter(s => s.totalProgress < 50).length;
        const avgProgress = Math.round(instructorTrainers.reduce((acc, s) => acc + s.totalProgress, 0) / instructorTrainers.length);

        // Mock topic performance based on trainer data availability
        // In a real app, we'd aggregate this from a more detailed hook
        const lowestTopic = "State Management";

        return {
            atRisk,
            avgProgress,
            lowestTopic
        };
    }, [instructorTrainers]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: inputMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInputMessage("");
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            const response: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `I can certainly help you with "${newMessage.content}". As an AI, I can assist with curriculum design, trainer engagement strategies, or technical explanations. What specific aspect would you like advice on?`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, response]);
            setIsTyping(false);
        }, 1500);
    };

    const handleGenerateQuiz = () => {
        if (!quizTopic) return;
        setIsGenerating(true);

        const targetAudience = assignmentMode === 'all'
            ? 'All Trainers'
            : `${selectedTrainers.length} Selected Trainers`;

        // Mock Generation
        setTimeout(() => {
            setGeneratedQuiz(JSON.stringify({
                topic: quizTopic,
                difficulty: quizDifficulty,
                assignedTo: targetAudience,
                attachment: quizAttachment?.name || "None",
                questions: [
                    {
                        question: `What is the primary function of ${quizTopic}?`,
                        options: ["Option A", "Option B", "Option C", "Option D"],
                        answer: "Option B"
                    },
                    {
                        question: `Which of the following best describes ${quizTopic}?`,
                        options: ["Concept X", "Concept Y", "Concept Z"],
                        answer: "Concept X"
                    }
                ]
            }, null, 2));
            setIsGenerating(false);
            toast({
                title: "Quiz Generated",
                description: `Created for ${targetAudience} with difficulty ${quizDifficulty}.`
            });
        }, 2000);
    };

    const handleGenerateLesson = () => {
        if (!lessonTopic) return;
        setIsGenerating(true);

        // Mock Generation
        setTimeout(() => {
            setGeneratedLesson(`
# Lesson Plan: ${lessonTopic}
**Context**: ${lessonAttachment ? `Based on ${lessonAttachment.name}` : "General Overview"}

## Learning Objectives
1. Understand the core concepts of ${lessonTopic}.
2. Apply ${lessonTopic} in real-world scenarios.

## Introduction (5 mins)
- Hook: Start with an interesting fact about ${lessonTopic}.
- Definition: Define key terms.

## Main Content (20 mins)
- Concept A: Detailed explanation.
- Concept B: Common pitfalls.
- Activity: Group discussion.

## Conclusion (5 mins)
- Recap key points.
- Q&A session.
            `);
            setIsGenerating(false);
            toast({ title: "Lesson Drafted", description: "Your lesson outline is ready." });
        }, 2000);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Content copied to clipboard." });
    };

    const handleTrainerToggle = (trainerId: string) => {
        setSelectedTrainers(prev =>
            prev.includes(trainerId)
                ? prev.filter(id => id !== trainerId)
                : [...prev, trainerId]
        );
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
                <div className="max-w-6xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Sparkles className="w-8 h-8 text-primary" />
                            AI Teaching Assistant
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Leverage AI to create content, grade assessments, and get teaching advice.
                        </p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="flex flex-wrap h-auto w-full max-w-2xl gap-2 bg-transparent border-none">
                            <TabsTrigger value="chat" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <MessageSquare className="w-4 h-4" /> Chat
                            </TabsTrigger>
                            <TabsTrigger value="quiz" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <CheckSquare className="w-4 h-4" /> Quiz Gen
                            </TabsTrigger>
                            <TabsTrigger value="lesson" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <FileText className="w-4 h-4" /> Lesson Drafter
                            </TabsTrigger>
                            <TabsTrigger value="insights" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <BarChart className="w-4 h-4" /> Insights
                            </TabsTrigger>
                        </TabsList>

                        {/* Chat Interface */}
                        <TabsContent value="chat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="h-[600px] flex flex-col">
                                <CardHeader>
                                    <CardTitle>Assistant Chat</CardTitle>
                                    <CardDescription>Ask questions about course structure, engagement, or technical topics.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden p-0">
                                    <ScrollArea className="h-full p-4">
                                        <div className="space-y-4">
                                            {messages.map((msg) => (
                                                <div key={msg.id} className={cn(
                                                    "flex gap-3 max-w-[80%]",
                                                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                                )}>
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                                        msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                                                    )}>
                                                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                                    </div>
                                                    <div className={cn(
                                                        "rounded-2xl px-4 py-2 text-sm",
                                                        msg.role === 'user'
                                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                                            : "bg-muted rounded-tl-none"
                                                    )}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {isTyping && (
                                                <div className="flex gap-3 mr-auto max-w-[80%]">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                    <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2 flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                                <CardFooter className="p-4 border-t">
                                    <div className="flex w-full items-center gap-2">
                                        <Input
                                            placeholder="Type your message..."
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            disabled={isTyping}
                                        />
                                        <Button size="icon" onClick={handleSendMessage} disabled={!inputMessage.trim() || isTyping}>
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        {/* Quiz Generator */}
                        <TabsContent value="quiz" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Quiz Generator</CardTitle>
                                        <CardDescription>Generate multiple-choice questions from a topic.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Topic or Concept</Label>
                                            <Input
                                                placeholder="e.g. React Hooks, Photosynthesis..."
                                                value={quizTopic}
                                                onChange={(e) => setQuizTopic(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Difficulty</Label>
                                            <Select value={quizDifficulty} onValueChange={setQuizDifficulty}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select difficulty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="easy">Easy</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="hard">Hard</SelectItem>
                                                    <SelectItem value="expert">Expert</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Assign To</Label>
                                            <RadioGroup
                                                value={assignmentMode}
                                                onValueChange={(val: "all" | "select") => setAssignmentMode(val)}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="all" id="all-trainers" />
                                                    <Label htmlFor="all-trainers">All Trainers</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="select" id="select-trainers" />
                                                    <Label htmlFor="select-trainers">Select Trainers</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {assignmentMode === 'select' && (
                                            <div className="border rounded-md p-3 h-40">
                                                <p className="text-xs text-muted-foreground mb-2">Select trainers to assign</p>
                                                <ScrollArea className="h-32">
                                                    <div className="space-y-2">
                                                        {instructorTrainers.length === 0 ? (
                                                            <div className="text-sm text-center text-muted-foreground py-4">No trainers found</div>
                                                        ) : (
                                                            instructorTrainers.map(trainer => (
                                                                <div key={trainer.id} className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`trainer-${trainer.id}`}
                                                                        checked={selectedTrainers.includes(trainer.id)}
                                                                        onCheckedChange={() => handleTrainerToggle(trainer.id)}
                                                                    />
                                                                    <Label htmlFor={`trainer-${trainer.id}`} className="text-sm cursor-pointer">
                                                                        {trainer.full_name}
                                                                    </Label>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2">
                                                Attachment (Optional)
                                            </Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    type="file"
                                                    className="cursor-pointer"
                                                    onChange={(e) => setQuizAttachment(e.target.files?.[0] || null)}
                                                />
                                            </div>
                                            {quizAttachment && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> Attached: {quizAttachment.name}
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={handleGenerateQuiz}
                                            disabled={!quizTopic || isGenerating}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4 mr-2" /> Generate Quiz
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="h-full">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Result</CardTitle>
                                        {generatedQuiz && (
                                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedQuiz)}>
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        {generatedQuiz ? (
                                            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto h-[450px]">
                                                {generatedQuiz}
                                            </pre>
                                        ) : (
                                            <div className="h-[450px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                                Generated content will appear here
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Lesson Drafter */}
                        <TabsContent value="lesson" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Lesson Drafter</CardTitle>
                                        <CardDescription>Create a structured lesson plan from a title.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Lesson Title</Label>
                                            <Input
                                                placeholder="e.g. Introduction to Thermodynamics"
                                                value={lessonTopic}
                                                onChange={(e) => setLessonTopic(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Target Audience level</Label>
                                            <Input placeholder="e.g. High School, Undergraduate" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2">
                                                Reference Material (Optional)
                                            </Label>
                                            <Input
                                                type="file"
                                                className="cursor-pointer"
                                                onChange={(e) => setLessonAttachment(e.target.files?.[0] || null)}
                                            />
                                            {lessonAttachment && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> Attached: {lessonAttachment.name}
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={handleGenerateLesson}
                                            disabled={!lessonTopic || isGenerating}
                                        >
                                            {isGenerating ? "Drafting..." : "Draft Lesson Plan"}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Draft</CardTitle>
                                        {generatedLesson && (
                                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedLesson)}>
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        {generatedLesson ? (
                                            <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
                                                <div className="whitespace-pre-wrap font-mono text-sm">
                                                    {generatedLesson}
                                                </div>
                                            </ScrollArea>
                                        ) : (
                                            <div className="h-[400px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                                Draft will appear here
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Insights */}
                        <TabsContent value="insights" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Trainer Performance Analysis</CardTitle>
                                    <CardDescription>AI-driven insights based on real trainer data.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {trainersLoading ? (
                                        <div className="flex items-center justify-center h-40">
                                            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Summary Cards */}
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div className="p-4 border rounded-lg bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                                        <p className="text-sm text-muted-foreground">Avg. Progress</p>
                                                    </div>
                                                    <p className="text-2xl font-bold">{insights?.avgProgress || 0}%</p>
                                                    <p className="text-xs text-muted-foreground">Class Average</p>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                        <p className="text-sm text-muted-foreground">At Risk Trainers</p>
                                                    </div>
                                                    <p className="text-2xl font-bold text-red-600">{insights?.atRisk || 0}</p>
                                                    <p className="text-xs text-muted-foreground">Below 50% Progress</p>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-4 h-4 text-primary" />
                                                        <p className="text-sm text-muted-foreground">Focus Area</p>
                                                    </div>
                                                    <p className="text-lg font-bold truncate">{insights?.lowestTopic || "None"}</p>
                                                    <p className="text-xs text-muted-foreground">Lowest performing topic</p>
                                                </div>
                                            </div>

                                            {/* AI Suggestion */}
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-4 items-start border border-blue-100 dark:border-blue-900">
                                                <Sparkles className="w-5 h-5 text-blue-600 mt-1 shrink-0" />
                                                <div>
                                                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">AI Recommendation</h4>
                                                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                                                        {insights?.atRisk && insights.atRisk > 0
                                                            ? `There are ${insights.atRisk} trainers falling behind. Consider scheduling a review session for "${insights?.lowestTopic}" or assigning extra practice quizzes.`
                                                            : "The class is performing well! You might challenge them with advanced projects or peer-review sessions."
                                                        }
                                                    </p>
                                                    <Button variant="link" className="p-0 h-auto text-blue-600 mt-2 text-xs">Generate Review Material for {insights?.lowestTopic}</Button>
                                                </div>
                                            </div>

                                            {/* Trainer Table */}
                                            <div className="mt-6">
                                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                                    <Users className="w-4 h-4" /> Trainer Analysis
                                                </h3>
                                                <div className="border rounded-md">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Trainer</TableHead>
                                                                <TableHead>Enrolled Courses</TableHead>
                                                                <TableHead>Overall Grade/Progress</TableHead>
                                                                <TableHead>Status</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {instructorTrainers.map((trainer) => (
                                                                <TableRow key={trainer.id}>
                                                                    <TableCell className="font-medium">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                                                                {trainer.full_name.charAt(0)}
                                                                            </div>
                                                                            {trainer.full_name}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>{trainer.enrolledCoursesCount}</TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                                                                <div
                                                                                    className={cn("h-full",
                                                                                        trainer.totalProgress >= 70 ? "bg-green-500" :
                                                                                            trainer.totalProgress >= 50 ? "bg-yellow-500" : "bg-red-500"
                                                                                    )}
                                                                                    style={{ width: `${trainer.totalProgress}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground">{trainer.totalProgress}%</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={trainer.totalProgress >= 50 ? "default" : "destructive"}>
                                                                            {trainer.totalProgress >= 50 ? "On Track" : "At Risk"}
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default InstructorAI;
