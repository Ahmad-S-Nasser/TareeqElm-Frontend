import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Lightbulb, ChevronLeft, ChevronRight, X, XCircle, CheckCircle2, Zap, Repeat } from "lucide-react";
import type { FlashcardCard, FlashcardRating } from "@/hooks/useFlashcards";
import { useReviewFlashcard } from "@/hooks/useFlashcards";

interface FlashcardStudySessionProps {
  cards: FlashcardCard[];
  onExit: () => void;
}

const ratingConfig: Record<FlashcardRating, { icon: typeof X; color: string; border: string; bg: string }> = {
  again: { icon: XCircle, color: "text-destructive", border: "border-destructive/20", bg: "hover:bg-destructive/10" },
  hard: { icon: RotateCcw, color: "text-warning-foreground", border: "border-warning/20", bg: "hover:bg-warning/10" },
  good: { icon: CheckCircle2, color: "text-success", border: "border-success/20", bg: "hover:bg-success/10" },
  easy: { icon: Zap, color: "text-primary", border: "border-primary/20", bg: "hover:bg-primary/10" },
};

/**
 * The flip-card study experience: one card at a time, flips to reveal the answer, then rate it.
 * The server owns the SM-2 schedule (POST /Flashcards/{id}/review); this component only renders and rates.
 */
export function FlashcardStudySession({ cards, onExit }: FlashcardStudySessionProps) {
  const { t, i18n } = useTranslation(["learning", "common"]);
  const { formatNumber } = useFormatters();
  const isRtl = i18n.dir() === "rtl";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<{ reviewed: number; correct: number }>({ reviewed: 0, correct: 0 });
  const [done, setDone] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    duration: 30,
    watchDrag: true,
    direction: isRtl ? "rtl" : "ltr",
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
    setIsFlipped(false);
    setShowHint(false);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const reviewMutation = useReviewFlashcard();

  const handleFlip = () => {
    setIsFlipped((f) => !f);
    setShowHint(false);
  };

  const handleRate = async (rating: FlashcardRating) => {
    const current = cards[currentIndex];
    if (!current || reviewMutation.isPending) return;
    try {
      await reviewMutation.mutateAsync({ id: current.id, rating });
    } catch (err) {
      toast.error(getApiError(err, t("learning:spaced.toast.saveReviewFailed")));
      return;
    }
    const correct = rating === "good" || rating === "easy";
    setResults((prev) => ({ reviewed: prev.reviewed + 1, correct: prev.correct + (correct ? 1 : 0) }));
    if (currentIndex >= cards.length - 1) {
      setDone(true);
    } else {
      emblaApi?.scrollNext();
    }
  };

  const handlePrevious = () => emblaApi?.scrollPrev();
  const handleNext = () => emblaApi?.scrollNext();

  if (cards.length === 0) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center gap-4">
        <p className="text-muted-foreground">{t("learning:flashcards.study.empty")}</p>
        <Button variant="outline" onClick={onExit}>{t("learning:flashcards.study.exit")}</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">{t("learning:flashcards.study.complete.title")}</h2>
          <p className="text-muted-foreground">
            {t("learning:flashcards.study.complete.summary", { count: results.reviewed, correct: results.correct })}
          </p>
        </div>
        <Button onClick={onExit} className="gap-2"><X className="w-4 h-4" />{t("learning:flashcards.study.exit")}</Button>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;
  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-8 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("learning:flashcards.study.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("learning:flashcards.study.cardOf", { current: formatNumber(currentIndex + 1), total: formatNumber(cards.length) })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} className="hover:bg-destructive/10 hover:text-destructive">
          <X className="w-4 h-4 me-2" />
          {t("learning:flashcards.study.exit")}
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-3xl h-1.5 bg-secondary rounded-full mb-10 overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Flashcard Area (Carousel) */}
      <div className="flex-1 w-full max-w-3xl overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {cards.map((card, index) => (
            <div key={card.id} className="flex-[0_0_100%] min-w-0 px-4 flex items-center justify-center">
              <div className="w-full relative py-12" style={{ perspective: "1000px" }}>
                <div
                  className="relative w-full aspect-[1.6/1] cursor-pointer transition-all duration-700 transform-gpu group"
                  onClick={index === currentIndex ? handleFlip : undefined}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: index === currentIndex && isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front Face — Question */}
                  <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                    <div className={cn(
                      "w-full h-full rounded-[2rem] bg-card border border-border shadow-xl p-12 flex flex-col items-center justify-center text-center",
                      "hover:shadow-2xl hover:border-primary/20 transition-all duration-300",
                      "bg-gradient-to-br from-card to-secondary/10"
                    )}>
                      <div className="absolute top-8 start-8">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium tracking-wider uppercase">
                          {t("learning:flashcards.study.question")}
                        </span>
                      </div>

                      <h3 className="text-3xl font-medium leading-tight text-foreground/90">{card.question}</h3>

                      {card.hint && !showHint && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute bottom-8 end-8 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                        >
                          <Lightbulb className="w-4 h-4 me-2" />
                          {t("learning:flashcards.study.hint")}
                        </Button>
                      )}

                      {showHint && index === currentIndex && card.hint && (
                        <div className="absolute bottom-8 start-1/2 -translate-x-1/2 w-3/4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-4 py-2 rounded-lg text-sm border border-yellow-500/20">
                            💡 {card.hint}
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-8 start-1/2 -translate-x-1/2 text-muted-foreground/30 text-sm font-medium flex items-center gap-2 group-hover:text-muted-foreground/50 transition-colors">
                        <Repeat className="w-3 h-3" />
                        {t("learning:flashcards.study.clickToFlip")}
                      </div>
                    </div>
                  </div>

                  {/* Back Face — Answer */}
                  <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                    <div className="w-full h-full rounded-[2rem] bg-card border border-primary/20 shadow-xl p-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 relative overflow-hidden">
                      <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                      <div className="absolute top-8 start-8">
                        <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium tracking-wider uppercase shadow-sm">
                          {t("learning:flashcards.study.answer")}
                        </span>
                      </div>
                      <div className="prose prose-lg dark:prose-invert max-w-none">
                        <p className="text-2xl leading-relaxed font-medium text-foreground/90 whitespace-pre-wrap">{card.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 w-full max-w-2xl">
        {!isFlipped ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={handlePrevious} disabled={!emblaApi?.canScrollPrev()}>
              <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
            </Button>
            <Button size="lg" onClick={handleFlip} className="h-12 px-8 rounded-full shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all">
              <RotateCcw className="w-4 h-4 me-2" />
              {t("learning:flashcards.study.reveal")}
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={handleNext} disabled={currentIndex === cards.length - 1}>
              <ChevronRight className="w-6 h-6 rtl:rotate-180" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-center text-muted-foreground font-medium">{t("learning:flashcards.study.howWell")}</p>
            <div className="grid grid-cols-4 gap-4">
              {(Object.keys(ratingConfig) as FlashcardRating[]).map((rating) => {
                const cfg = ratingConfig[rating];
                const Icon = cfg.icon;
                return (
                  <Button
                    key={rating}
                    variant="outline"
                    disabled={reviewMutation.isPending}
                    className={cn("h-24 flex-col gap-3 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg", cfg.border, cfg.bg)}
                    onClick={() => handleRate(rating)}
                  >
                    {reviewMutation.isPending && reviewMutation.variables?.id === currentCard?.id ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className={cn("w-6 h-6", cfg.color)} />
                    )}
                    <span className={cn("font-medium", cfg.color)}>{t(`learning:spaced.rating.${rating}`)}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
