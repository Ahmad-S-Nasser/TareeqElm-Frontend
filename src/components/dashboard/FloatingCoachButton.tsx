import { useState, useRef, useEffect } from "react";
import { Brain, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useStudyCoach } from "@/hooks/useStudyCoach";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const FloatingCoachButton = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, trainerData } = useStudyCoach();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input, "chat");
    setInput("");
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("floatingCoach.toggle")}
        className={cn(
          "fixed bottom-6 end-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          "bg-primary text-primary-foreground hover:scale-110 active:scale-95",
          open && "rotate-0"
        )}
      >
        {open ? <X className="w-6 h-6" /> : <Brain className="w-6 h-6" />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 end-6 z-50 w-[380px] max-h-[500px] rounded-2xl bg-card border border-border shadow-xl flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t("coachWidget.title")}</p>
                <p className="text-xs text-muted-foreground">{t("floatingCoach.subtitle")}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/ai-coach')} className="text-xs text-primary">
              {t("floatingCoach.fullView")}
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 max-h-[320px] px-3 py-2" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/30" />
                  <p className="text-xs text-muted-foreground">{t("floatingCoach.askAnything")}</p>
                  <div className="mt-3 space-y-1.5">
                    {(["study", "progress", "motivate"] as const).map(k => t(`floatingCoach.suggestions.${k}`)).map(q => (
                      <button
                        key={q}
                        className="block w-full text-start text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => sendMessage(q, "chat")}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.Id} className={cn(
                  "flex gap-2 max-w-[90%]",
                  msg.Role === 'user' ? "ms-auto flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "rounded-xl px-3 py-2 text-xs whitespace-pre-wrap",
                    msg.Role === 'user'
                      ? "bg-primary text-primary-foreground rounded-se-none"
                      : "bg-muted rounded-ss-none"
                  )}>
                    {msg.Content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.Role !== 'assistant' && (
                <div className="flex gap-2">
                  <div className="bg-muted rounded-xl rounded-ss-none px-3 py-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t">
            <form className="flex gap-2" onSubmit={handleSend}>
              <Input
                placeholder={t("floatingCoach.placeholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="rounded-lg text-sm h-9"
              />
              <Button type="submit" size="icon" aria-label={t("chatBar.send")} className="h-9 w-9 shrink-0" disabled={isLoading || !input.trim()}>
                <Send className="w-3.5 h-3.5 rtl:-scale-x-100" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
