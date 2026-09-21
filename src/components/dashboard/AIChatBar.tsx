import { useState, useEffect } from "react";
import { Mic, MicOff, Send, Sparkles, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useToast } from "@/hooks/use-toast";

interface AIChatBarProps {
  onSend?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const AIChatBar = ({
  onSend,
  isLoading = false,
  placeholder
}: AIChatBarProps) => {
  const { t } = useTranslation("dashboard");
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVoiceStarting, setIsVoiceStarting] = useState(false);
  const { isListening, transcript, volume, startListening, stopListening, setTranscript } = useVoiceRecognition();
  const { toast } = useToast();

  useEffect(() => {
    if (isListening) {
      setIsVoiceStarting(false);
      if (transcript) setMessage(transcript);
    }
  }, [isListening, transcript]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend?.(message.trim());
      setMessage("");
      setTranscript("");
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
      setIsVoiceStarting(false);
    } else {
      setIsVoiceStarting(true);
      setTranscript("");
      setMessage("");
      startListening((text) => {
        if (text.trim()) {
          onSend?.(text);
        }
        setIsExpanded(false);
        setIsVoiceStarting(false);
      });
      toast({
        title: t("chatBar.micActivating"),
        description: t("chatBar.micActivatingDesc"),
      });
    }
  };

  return (
    <div className="fixed bottom-0 start-0 end-0 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-50">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <div className={cn(
          "relative rounded-2xl bg-card border border-border/50 shadow-elevated transition-all duration-300",
          isExpanded && "rounded-b-none"
        )}>
          {/* AI Glow Effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 blur-xl opacity-50 -z-10 animate-pulse-glow" />

          {/* Main Container */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 p-3">
              {/* AI Icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>

              {/* Input Wrapper */}
              <div className="flex-1 relative flex flex-col gap-2">
                {(isListening || isVoiceStarting) && (
                  <div className="absolute bottom-full start-0 w-full mb-4 bg-background/90 border border-primary/20 backdrop-blur-xl rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex gap-1 h-4 items-center">
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-primary rounded-full animate-voice-bar"
                            style={{ animationDelay: `${i * 150}ms`, height: '100%' }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        {isVoiceStarting ? t("chatBar.initializing") : t("chatBar.listening")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 italic font-medium truncate">
                      {isVoiceStarting ? t("chatBar.warmingUp") : (transcript || t("chatBar.speakNow"))}
                    </p>
                  </div>
                )}

                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="w-full bg-transparent border-none outline-none py-2 text-sm"
                    placeholder={(isListening || isVoiceStarting) ? t("chatBar.listeningEllipsis") : (placeholder ?? t("chatBar.placeholder"))}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsExpanded(true)}
                    disabled={isLoading || isListening || isVoiceStarting}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "p-2 rounded-xl transition-all duration-75",
                    (isListening || isVoiceStarting) ? "bg-destructive/10 text-destructive border border-destructive/20" : "text-muted-foreground hover:text-primary"
                  )}
                  style={isListening ? { transform: `scale(${1 + (volume / 100)})` } : {}}
                  onClick={toggleVoice}
                  aria-label={(isListening || isVoiceStarting) ? t("chatBar.stopVoice") : t("chatBar.startVoice")}
                  disabled={isLoading || (isVoiceStarting && !isListening)}
                >
                  {(isListening || isVoiceStarting) ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="rounded-xl shadow-glow-primary bg-primary text-primary-foreground"
                  onClick={handleSend}
                  aria-label={t("chatBar.send")}
                  disabled={!message.trim() || isLoading || isListening || isVoiceStarting}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 rtl:-scale-x-100" />
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Suggestions */}
            {isExpanded && !isListening && (
              <div className="px-3 pb-3 flex flex-wrap gap-2 animate-fade-in border-t border-border/10 pt-3">
                {(["explain", "quiz", "weak", "flashcards"] as const).map((key) => t(`chatBar.suggestions.${key}`)).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      onSend?.(suggestion);
                      setIsExpanded(false);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
                <button
                  aria-label={t("chatBar.close")}
                  onClick={() => setIsExpanded(false)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground ms-auto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
