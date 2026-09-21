import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw, Coffee, Brain } from "lucide-react";
import { toast } from "sonner";

interface PomodoroTimerProps {
  activeBlockTitle?: string | null;
  onSessionComplete?: () => void;
}

type TimerMode = "focus" | "short-break" | "long-break";

const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  "short-break": 5 * 60,
  "long-break": 15 * 60,
};

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

export const PomodoroTimer = ({ activeBlockTitle, onSessionComplete }: PomodoroTimerProps) => {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (activeBlockTitle) {
      setMode("focus"); setTimeLeft(DURATIONS.focus); setIsRunning(true);
      toast.info(`Pomodoro started for: ${activeBlockTitle}`);
    }
  }, [activeBlockTitle]);

  const hasTimeLeft = timeLeft > 0;

  useEffect(() => {
    clearTimer();
    if (isRunning && hasTimeLeft) {
      intervalRef.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return clearTimer;
  }, [isRunning, hasTimeLeft, clearTimer]);

  useEffect(() => {
    if (timeLeft <= 0 && isRunning) {
      setIsRunning(false);
      if (mode === "focus") {
        const newCount = completedPomodoros + 1;
        setCompletedPomodoros(newCount);
        toast.success(`Pomodoro #${newCount} complete! Take a break.`);
        onSessionComplete?.();
        const nextMode = newCount % 4 === 0 ? "long-break" : "short-break";
        setMode(nextMode); setTimeLeft(DURATIONS[nextMode]);
      } else {
        toast.info("Break over! Ready to focus again.");
        setMode("focus"); setTimeLeft(DURATIONS.focus);
      }
    }
  }, [timeLeft, isRunning, mode, completedPomodoros, onSessionComplete]);

  const toggleTimer = () => setIsRunning((r) => !r);
  const resetTimer = () => { setIsRunning(false); setTimeLeft(DURATIONS[mode]); };
  const switchMode = (newMode: TimerMode) => { setIsRunning(false); setMode(newMode); setTimeLeft(DURATIONS[newMode]); };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((DURATIONS[mode] - timeLeft) / DURATIONS[mode]) * 100;
  const strokeColor = mode === "focus" ? "hsl(var(--primary))" : mode === "short-break" ? "hsl(var(--success))" : "hsl(var(--accent))";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {mode === "focus" ? <Brain className="w-4 h-4 text-primary" /> : <Coffee className="w-4 h-4 text-success" />}
            Pomodoro
          </h3>
          <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
            {(["focus", "short-break", "long-break"] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-md transition-all font-medium",
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {activeBlockTitle && (
          <p className="text-[11px] text-muted-foreground mb-3 truncate bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/10">
            📌 {activeBlockTitle}
          </p>
        )}

        <div className="flex flex-col items-center py-3">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="5" opacity="0.2" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={strokeColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}</span>
              <span className="text-[10px] text-muted-foreground">{modeLabels[mode]}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-1">
          <Button variant="outline" size="icon" onClick={resetTimer} className="h-8 w-8 rounded-lg">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={toggleTimer} className="gap-2 px-5 h-9 rounded-lg" size="sm">
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? "Pause" : "Start"}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-all", i < completedPomodoros % 4 ? "bg-primary" : "bg-border")} />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">{completedPomodoros} done</span>
        </div>
      </CardContent>
    </Card>
  );
};
