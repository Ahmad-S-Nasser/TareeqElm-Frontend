import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { ApplicantSidebar } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sparkles,
    Send,
    Bot,
    User,
    BookOpen,
    Brain,
    Zap,
    Trash2,
    Mic,
    MicOff,
    Volume2,
    StopCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIChat } from "@/hooks/useAIChat";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useToast } from "@/hooks/use-toast";

const TrainerAITutor = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t, i18n } = useTranslation("dashboard");
    const { formatNumber } = useFormatters();
    const [searchParams, setSearchParams] = useSearchParams();
    const { messages, isLoading, sendMessage, clearHistory } = useAIChat();
    const [inputMessage, setInputMessage] = useState("");
    const [activeTab, setActiveTab] = useState("chat");
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [revealedTranscriptIds, setRevealedTranscriptIds] = useState<Set<string>>(new Set());

    const [isVoiceStarting, setIsVoiceStarting] = useState(false);

    const { isListening, transcript, volume, startListening, stopListening, setTranscript } = useVoiceRecognition();
    const { toast } = useToast();

    const handleToggleVoice = () => {
        if (isListening) {
            stopListening();
            setIsVoiceStarting(false);
        } else {
            setIsVoiceStarting(true);
            setTranscript("");
            setInputMessage("");
            startListening((text) => {
                if (text.trim()) {
                    sendMessage(text, activeTab);
                }
                setIsVoiceStarting(false);
            });
            toast({
                title: t("tutor.micActivating"),
                description: t("tutor.micActivatingDesc"),
            });
        }
    };

    const toggleReveal = (id: string) => {
        setRevealedTranscriptIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const speakMessage = (text: string, id: string) => {
        if (speakingId === id) {
            window.speechSynthesis.cancel();
            setSpeakingId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        // Read aloud in the active language.
        utterance.lang = i18n.language?.startsWith("ar") ? "ar-SA" : "en-US";
        utterance.onend = () => setSpeakingId(null);
        setSpeakingId(id);
        window.speechSynthesis.speak(utterance);
    };

    // Latest speakMessage for the auto-speak effect (which must only fire when messages change).
    const speakMessageRef = useRef(speakMessage);
    speakMessageRef.current = speakMessage;

    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
            stopListening();
        };
    }, [stopListening]);

    // 1. Synchronize voice state with UI while listening
    useEffect(() => {
        if (isListening) {
            setIsVoiceStarting(false);
            if (transcript) setInputMessage(transcript);
        }
    }, [isListening, transcript]);

    // 3. Auto-speak new AI messages
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.kind && lastMessage.id !== '1') {
            setTimeout(() => {
                speakMessageRef.current(lastMessage.content, lastMessage.id);
            }, 100);
        }
    }, [messages]);

    useEffect(() => {
        const query = searchParams.get("q");
        if (query) {
            sendMessage(query);
            setSearchParams({});
        }
    }, [searchParams, sendMessage, setSearchParams]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;
        sendMessage(inputMessage, activeTab);
        setInputMessage("");
    };

    const suggestedPrompts = (["explain", "schedule", "quiz", "summarize"] as const).map((k) => t(`tutor.prompts.${k}`));

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ms-20" : "ms-64"
            )}>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Sparkles className="w-8 h-8 text-primary" />
                            {t("tutor.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t("tutor.subtitle")}
                        </p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid grid-cols-3 w-full max-w-xl">
                            <TabsTrigger value="chat" className="gap-2"><Bot className="w-4 h-4" /> {t("tutor.tabs.chat")}</TabsTrigger>
                            <TabsTrigger value="study" className="gap-2"><BookOpen className="w-4 h-4" /> {t("tutor.tabs.study")}</TabsTrigger>
                            <TabsTrigger value="quiz" className="gap-2"><Brain className="w-4 h-4" /> {t("tutor.tabs.quiz")}</TabsTrigger>
                        </TabsList>

                        <div className="grid lg:grid-cols-4 gap-6">
                            {/* Chat Area */}
                            <Card className="lg:col-span-3 h-[600px] flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>{t("tutor.conversation")}</CardTitle>
                                        <CardDescription>
                                            {t(`tutor.tabDesc.${activeTab}`)}
                                        </CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground">
                                        <Trash2 className="w-4 h-4 me-2" />
                                        {t("tutor.clear")}
                                    </Button>
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

                                                    {msg.role === 'assistant' ? (
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <div className={cn(
                                                                "rounded-2xl px-6 py-4 text-sm relative group/msg bg-muted border border-border/50 shadow-sm",
                                                                "flex items-center gap-4 min-w-[200px]"
                                                            )}>
                                                                <button
                                                                    onClick={() => speakMessage(msg.content, msg.id)}
                                                                    aria-label={speakingId === msg.id ? t("tutor.stopSpeaking") : t("tutor.readAloud")}
                                                                    className={cn(
                                                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                                        speakingId === msg.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                                                                    )}
                                                                >
                                                                    {speakingId === msg.id ? (
                                                                        <StopCircle className="w-5 h-5" />
                                                                    ) : (
                                                                        <Volume2 className="w-5 h-5" />
                                                                    )}
                                                                </button>

                                                                <div className="flex-1 flex flex-col">
                                                                    <div className="flex items-center gap-1 h-8">
                                                                        {[...Array(12)].map((_, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className={cn(
                                                                                    "w-1 bg-primary/30 rounded-full transition-all duration-300",
                                                                                    speakingId === msg.id ? "animate-voice-bar" : "h-1"
                                                                                )}
                                                                                style={{
                                                                                    height: speakingId === msg.id ? `${Math.random() * 100}%` : '4px',
                                                                                    animationDelay: `${i * 100}ms`
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">{t("tutor.voiceResponse")}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-start">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-xs h-7 text-primary/70 hover:text-primary hover:bg-primary/10"
                                                                    onClick={() => toggleReveal(msg.id)}
                                                                >
                                                                    {revealedTranscriptIds.has(msg.id) ? t("tutor.hideTranscript") : t("tutor.showTranscript")}
                                                                </Button>
                                                            </div>

                                                            {revealedTranscriptIds.has(msg.id) && (
                                                                <div dir="auto" className="bg-card border border-border/50 rounded-xl p-4 text-sm leading-relaxed animate-in fade-in slide-in-from-top-2">
                                                                    {msg.content}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div dir="auto" className={cn(
                                                            "rounded-2xl px-4 py-2 text-sm",
                                                            "bg-primary text-primary-foreground rounded-se-none shadow-sm"
                                                        )}>
                                                            {msg.content}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {isLoading && (
                                                <div className="flex gap-3 me-auto max-w-[80%]">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                    <div className="bg-muted rounded-2xl rounded-ss-none px-4 py-2 flex items-center gap-1 shadow-sm">
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                                <CardFooter className="p-4 border-t flex flex-col gap-3">
                                    {(isListening || isVoiceStarting) && (
                                        <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3 animate-in fade-in zoom-in">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Mic className="w-4 h-4 text-primary animate-pulse" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-tighter">
                                                    {isVoiceStarting ? t("tutor.initializing") : t("tutor.transcribing")}
                                                </p>
                                                <p className="text-sm text-foreground/80 italic">
                                                    {isVoiceStarting ? t("tutor.warmingUp") : (transcript || t("tutor.speakNow"))}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <form
                                        className="flex w-full items-center gap-2"
                                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                    >
                                        <Input
                                            placeholder={activeTab === 'quiz' ? t("tutor.answerPlaceholder") : t("tutor.questionPlaceholder")}
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            disabled={isLoading || isListening || isVoiceStarting}
                                            className="rounded-xl"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "rounded-xl transition-all duration-75 min-w-[40px]",
                                                (isListening || isVoiceStarting) ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-muted hover:bg-muted/80"
                                            )}
                                            style={isListening ? { transform: `scale(${1 + (volume / 100)})` } : {}}
                                            onClick={handleToggleVoice}
                                            aria-label={(isListening || isVoiceStarting) ? t("chatBar.stopVoice") : t("chatBar.startVoice")}
                                            disabled={isLoading || (isVoiceStarting && !isListening)}
                                        >
                                            {(isListening || isVoiceStarting) ? (
                                                <MicOff className="w-4 h-4" />
                                            ) : (
                                                <Mic className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button type="submit" size="icon" aria-label={t("chatBar.send")} disabled={!inputMessage.trim() || isLoading || isListening || isVoiceStarting} className="rounded-xl">
                                            <Send className="w-4 h-4 rtl:-scale-x-100" />
                                        </Button>
                                    </form>
                                </CardFooter>
                            </Card>

                            {/* Sidebar / Suggestions */}
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">{t("tutor.quickActions")}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {suggestedPrompts.map((prompt, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                className="w-full justify-start h-auto py-2 px-3 text-xs text-start whitespace-normal leading-snug"
                                                onClick={() => {
                                                    sendMessage(prompt, activeTab);
                                                }}
                                            >
                                                <Zap className="w-3 h-3 me-2 shrink-0 text-yellow-500" />
                                                {prompt}
                                            </Button>
                                        ))}
                                    </CardContent>
                                </Card>

                                <Card className="bg-primary/5 border-primary/20">
                                    <CardHeader>
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-primary" />
                                            {t("tutor.learningStats")}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t("tutor.topicsMastered")}</span>
                                            <span className="font-medium">{formatNumber(12)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t("tutor.questionsAsked")}</span>
                                            <span className="font-medium">{formatNumber(45)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default TrainerAITutor;
