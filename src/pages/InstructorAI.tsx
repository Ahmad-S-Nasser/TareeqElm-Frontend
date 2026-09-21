import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
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
    const { t } = useTranslation("instructor");
    const { formatPercent, formatNumber } = useFormatters();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState("chat");
    const { toast } = useToast();
    const { trainers: instructorTrainers, loading: trainersLoading } = useInstructorTrainers();

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '',
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
        const lowestTopic = t("ai.insights.mockTopic");

        return {
            atRisk,
            avgProgress,
            lowestTopic
        };
    }, [instructorTrainers, t]);

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
                content: t("ai.chat.reply", { message: newMessage.content }),
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
            ? t("ai.quiz.audienceAll")
            : t("ai.quiz.audienceSelected", { count: selectedTrainers.length });

        // Mock Generation
        setTimeout(() => {
            setGeneratedQuiz(JSON.stringify({
                topic: quizTopic,
                difficulty: quizDifficulty,
                assignedTo: targetAudience,
                attachment: quizAttachment?.name || t("ai.quiz.none"),
                questions: [
                    {
                        question: t("ai.quiz.q1", { topic: quizTopic }),
                        options: [t("ai.quiz.optionA"), t("ai.quiz.optionB"), t("ai.quiz.optionC"), t("ai.quiz.optionD")],
                        answer: t("ai.quiz.optionB")
                    },
                    {
                        question: t("ai.quiz.q2", { topic: quizTopic }),
                        options: [t("ai.quiz.conceptX"), t("ai.quiz.conceptY"), t("ai.quiz.conceptZ")],
                        answer: t("ai.quiz.conceptX")
                    }
                ]
            }, null, 2));
            setIsGenerating(false);
            toast({
                title: t("ai.quiz.generated"),
                description: t("ai.quiz.generatedDesc", { audience: targetAudience, difficulty: t(`ai.quiz.difficultyLevels.${quizDifficulty}`) })
            });
        }, 2000);
    };

    const handleGenerateLesson = () => {
        if (!lessonTopic) return;
        setIsGenerating(true);

        // Mock Generation
        setTimeout(() => {
            setGeneratedLesson(t("ai.lesson.plan", {
                topic: lessonTopic,
                context: lessonAttachment ? t("ai.lesson.context", { name: lessonAttachment.name }) : t("ai.lesson.contextGeneral"),
            }));
            setIsGenerating(false);
            toast({ title: t("ai.lesson.drafted"), description: t("ai.lesson.draftedDesc") });
        }, 2000);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: t("ai.lesson.copied"), description: t("ai.lesson.copiedDesc") });
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
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-6xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Sparkles className="w-8 h-8 text-primary" />
                            {t("ai.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t("ai.subtitle")}
                        </p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="flex flex-wrap h-auto w-full max-w-2xl gap-2 bg-transparent border-none">
                            <TabsTrigger value="chat" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <MessageSquare className="w-4 h-4" /> {t("ai.tabs.chat")}
                            </TabsTrigger>
                            <TabsTrigger value="quiz" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <CheckSquare className="w-4 h-4" /> {t("ai.tabs.quiz")}
                            </TabsTrigger>
                            <TabsTrigger value="lesson" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <FileText className="w-4 h-4" /> {t("ai.tabs.lesson")}
                            </TabsTrigger>
                            <TabsTrigger value="insights" className="gap-2 bg-muted data-[state=active]:bg-primary data-[state=active]:text-white">
                                <BarChart className="w-4 h-4" /> {t("ai.tabs.insights")}
                            </TabsTrigger>
                        </TabsList>

                        {/* Chat Interface */}
                        <TabsContent value="chat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="h-[600px] flex flex-col">
                                <CardHeader>
                                    <CardTitle>{t("ai.chat.title")}</CardTitle>
                                    <CardDescription>{t("ai.chat.description")}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden p-0">
                                    <ScrollArea className="h-full p-4">
                                        <div className="space-y-4">
                                            {messages.map((msg) => (
                                                <div key={msg.id} className={cn(
                                                    "flex gap-3 max-w-[80%]",
                                                    msg.role === 'user' ? "ms-auto flex-row-reverse" : "me-auto"
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
                                                            ? "bg-primary text-primary-foreground rounded-se-none"
                                                            : "bg-muted rounded-ss-none"
                                                    )}>
                                                        {msg.id === "welcome" ? t("ai.chat.welcome") : msg.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {isTyping && (
                                                <div className="flex gap-3 me-auto max-w-[80%]">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                    <div className="bg-muted rounded-2xl rounded-ss-none px-4 py-2 flex items-center gap-1">
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
                                            placeholder={t("ai.chat.placeholder")}
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            disabled={isTyping}
                                        />
                                        <Button size="icon" aria-label={t("ai.chat.send")} onClick={handleSendMessage} disabled={!inputMessage.trim() || isTyping}>
                                            <Send className="w-4 h-4 rtl:-scale-x-100" />
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
                                        <CardTitle>{t("ai.quiz.title")}</CardTitle>
                                        <CardDescription>{t("ai.quiz.description")}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>{t("ai.quiz.topic")}</Label>
                                            <Input
                                                placeholder={t("ai.quiz.topicPlaceholder")}
                                                value={quizTopic}
                                                onChange={(e) => setQuizTopic(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>{t("ai.quiz.difficulty")}</Label>
                                            <Select value={quizDifficulty} onValueChange={setQuizDifficulty}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t("ai.quiz.selectDifficulty")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="easy">{t("ai.quiz.difficultyLevels.easy")}</SelectItem>
                                                    <SelectItem value="medium">{t("ai.quiz.difficultyLevels.medium")}</SelectItem>
                                                    <SelectItem value="hard">{t("ai.quiz.difficultyLevels.hard")}</SelectItem>
                                                    <SelectItem value="expert">{t("ai.quiz.difficultyLevels.expert")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>{t("ai.quiz.assignTo")}</Label>
                                            <RadioGroup
                                                value={assignmentMode}
                                                onValueChange={(val: "all" | "select") => setAssignmentMode(val)}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="all" id="all-trainers" />
                                                    <Label htmlFor="all-trainers">{t("ai.quiz.allTrainers")}</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="select" id="select-trainers" />
                                                    <Label htmlFor="select-trainers">{t("ai.quiz.selectTrainers")}</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {assignmentMode === 'select' && (
                                            <div className="border rounded-md p-3 h-40">
                                                <p className="text-xs text-muted-foreground mb-2">{t("ai.quiz.selectToAssign")}</p>
                                                <ScrollArea className="h-32">
                                                    <div className="space-y-2">
                                                        {instructorTrainers.length === 0 ? (
                                                            <div className="text-sm text-center text-muted-foreground py-4">{t("ai.quiz.noTrainers")}</div>
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
                                                {t("ai.quiz.attachment")}
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
                                                    <FileText className="w-3 h-3" /> {t("ai.quiz.attached", { name: quizAttachment.name })}
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
                                                    <RefreshCw className="w-4 h-4 me-2 animate-spin" /> {t("ai.quiz.generating")}
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4 me-2" /> {t("ai.quiz.generate")}
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="h-full">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>{t("ai.quiz.result")}</CardTitle>
                                        {generatedQuiz && (
                                            <Button variant="ghost" size="sm" aria-label={t("ai.quiz.copy")} onClick={() => copyToClipboard(generatedQuiz)}>
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        {generatedQuiz ? (
                                            <pre dir="ltr" className="bg-muted p-4 rounded-lg text-xs overflow-auto h-[450px]">
                                                {generatedQuiz}
                                            </pre>
                                        ) : (
                                            <div className="h-[450px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                                {t("ai.quiz.placeholderResult")}
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
                                        <CardTitle>{t("ai.lesson.title")}</CardTitle>
                                        <CardDescription>{t("ai.lesson.description")}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>{t("ai.lesson.lessonTitle")}</Label>
                                            <Input
                                                placeholder={t("ai.lesson.lessonPlaceholder")}
                                                value={lessonTopic}
                                                onChange={(e) => setLessonTopic(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t("ai.lesson.audienceLevel")}</Label>
                                            <Input placeholder={t("ai.lesson.audiencePlaceholder")} />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2">
                                                {t("ai.lesson.reference")}
                                            </Label>
                                            <Input
                                                type="file"
                                                className="cursor-pointer"
                                                onChange={(e) => setLessonAttachment(e.target.files?.[0] || null)}
                                            />
                                            {lessonAttachment && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> {t("ai.lesson.attached", { name: lessonAttachment.name })}
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={handleGenerateLesson}
                                            disabled={!lessonTopic || isGenerating}
                                        >
                                            {isGenerating ? t("ai.lesson.drafting") : t("ai.lesson.draft")}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>{t("ai.lesson.draftTitle")}</CardTitle>
                                        {generatedLesson && (
                                            <Button variant="ghost" size="sm" aria-label={t("ai.quiz.copy")} onClick={() => copyToClipboard(generatedLesson)}>
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
                                                {t("ai.lesson.placeholderDraft")}
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
                                    <CardTitle>{t("ai.insights.title")}</CardTitle>
                                    <CardDescription>{t("ai.insights.description")}</CardDescription>
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
                                                        <p className="text-sm text-muted-foreground">{t("ai.insights.avgProgress")}</p>
                                                    </div>
                                                    <p className="text-2xl font-bold">{formatPercent(insights?.avgProgress || 0)}</p>
                                                    <p className="text-xs text-muted-foreground">{t("ai.insights.classAverage")}</p>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                        <p className="text-sm text-muted-foreground">{t("ai.insights.atRisk")}</p>
                                                    </div>
                                                    <p className="text-2xl font-bold text-red-600">{formatNumber(insights?.atRisk || 0)}</p>
                                                    <p className="text-xs text-muted-foreground">{t("ai.insights.below50")}</p>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-4 h-4 text-primary" />
                                                        <p className="text-sm text-muted-foreground">{t("ai.insights.focusArea")}</p>
                                                    </div>
                                                    <p className="text-lg font-bold truncate">{insights?.lowestTopic || t("common:labels.none")}</p>
                                                    <p className="text-xs text-muted-foreground">{t("ai.insights.lowestTopic")}</p>
                                                </div>
                                            </div>

                                            {/* AI Suggestion */}
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-4 items-start border border-blue-100 dark:border-blue-900">
                                                <Sparkles className="w-5 h-5 text-blue-600 mt-1 shrink-0" />
                                                <div>
                                                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">{t("ai.insights.recommendation")}</h4>
                                                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                                                        {insights?.atRisk && insights.atRisk > 0
                                                            ? t("ai.insights.behind", { count: insights.atRisk, topic: insights?.lowestTopic })
                                                            : t("ai.insights.performingWell")
                                                        }
                                                    </p>
                                                    <Button variant="link" className="p-0 h-auto text-blue-600 mt-2 text-xs">{t("ai.insights.generateReview", { topic: insights?.lowestTopic ?? "" })}</Button>
                                                </div>
                                            </div>

                                            {/* Trainer Table */}
                                            <div className="mt-6">
                                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                                    <Users className="w-4 h-4" /> {t("ai.insights.analysis")}
                                                </h3>
                                                <div className="border rounded-md">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>{t("ai.insights.columns.trainer")}</TableHead>
                                                                <TableHead>{t("ai.insights.columns.courses")}</TableHead>
                                                                <TableHead>{t("ai.insights.columns.progress")}</TableHead>
                                                                <TableHead>{t("ai.insights.columns.status")}</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {instructorTrainers.map((trainer) => (
                                                                <TableRow key={trainer.id}>
                                                                    <TableCell className="font-medium">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                                                                {(trainer.full_name ?? "").charAt(0)}
                                                                            </div>
                                                                            {trainer.full_name}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>{formatNumber(trainer.enrolledCoursesCount)}</TableCell>
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
                                                                            <span className="text-xs text-muted-foreground">{formatPercent(trainer.totalProgress)}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={trainer.totalProgress >= 50 ? "default" : "destructive"}>
                                                                            {trainer.totalProgress >= 50 ? t("ai.insights.onTrack") : t("ai.insights.atRiskBadge")}
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
