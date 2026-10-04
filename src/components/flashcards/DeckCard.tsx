import { useTranslation } from "react-i18next";
import { Layers, BookOpen, User, Lock, Globe, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Deck } from "@/hooks/useDecks";

interface DeckCardProps {
  deck: Deck;
  isOwner: boolean;
  onOpen: () => void;
  /** Omitted when the signed-in user has no flashcards.use permission (e.g. an instructor browsing their own deck). */
  onAddToMyCards?: () => void;
  addingToMyCards?: boolean;
}

export function DeckCard({ deck, isOwner, onOpen, onAddToMyCards, addingToMyCards }: DeckCardProps) {
  const { t } = useTranslation("learning");

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden transition-all duration-300 hover:shadow-elevated">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="text-start min-w-0 group">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">{deck.Title}</h3>
          </button>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {deck.Kind === "Instructor" ? t("flashcards.kind.instructor") : t("flashcards.kind.personal")}
          </Badge>
        </div>

        {deck.Description && <p className="text-sm text-muted-foreground line-clamp-2">{deck.Description}</p>}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> {t("flashcards.cardsCount", { count: deck.CardCount })}
          </span>
          {deck.CourseTitle && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <BookOpen className="w-3 h-3" /> {deck.CourseTitle}
            </Badge>
          )}
          {deck.Kind === "Instructor" && !isOwner && deck.OwnerName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {t("flashcards.byInstructor", { name: deck.OwnerName })}
            </span>
          )}
          {isOwner && deck.Kind === "Instructor" && (
            <Badge variant="outline" className="text-[10px] gap-1">
              {deck.Visibility === "Published" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {deck.Visibility === "Published" ? t("flashcards.visibility.published") : t("flashcards.visibility.private")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onOpen} className="flex-1">
            {t("flashcards.manage")}
          </Button>
          {onAddToMyCards && (
            <Button size="sm" onClick={onAddToMyCards} disabled={addingToMyCards} className="flex-1 gap-1.5">
              {addingToMyCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {t("flashcards.addToMyCards")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeckCard;
