import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/hooks/useAchievements";

interface Props {
  achievements: Achievement[];
  onDismiss: () => void;
}

export const AchievementUnlockToast = ({ achievements, onDismiss }: Props) => {
  const { t } = useTranslation("dashboard");
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (achievements.length > 0) {
      setVisible(true);
      setCurrentIndex(0);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 500);
      }, 4000 * achievements.length);
      return () => clearTimeout(timer);
    }
  }, [achievements, onDismiss]);

  useEffect(() => {
    if (achievements.length > 1 && visible) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % achievements.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [achievements.length, visible]);

  if (achievements.length === 0) return null;

  const current = achievements[currentIndex];
  if (!current) return null;

  const tierGlow = {
    bronze: "shadow-[0_0_30px_rgba(234,88,12,0.3)]",
    silver: "shadow-[0_0_30px_rgba(148,163,184,0.3)]",
    gold: "shadow-[0_0_30px_rgba(245,158,11,0.4)]",
    platinum: "shadow-[0_0_30px_rgba(139,92,246,0.4)]",
  };

  return (
    <div className={cn(
      "fixed top-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500",
      visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
    )}>
      <div className={cn(
        "bg-card border border-border rounded-2xl px-6 py-4 flex items-center gap-4 min-w-[320px]",
        tierGlow[current.tier],
        "animate-in zoom-in-95 duration-500"
      )}>
        <div className="text-4xl animate-bounce">{current.icon}</div>
        <div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">{t("achievements.unlocked")}</p>
          <p className="text-base font-bold mt-0.5">{current.title}</p>
          <p className="text-xs text-muted-foreground">{current.description}</p>
        </div>
        <button aria-label={t("achievements.dismiss")} onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }} className="ms-auto text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
    </div>
  );
};
