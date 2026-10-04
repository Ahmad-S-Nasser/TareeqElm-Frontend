import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Renders the server-computed `IsMastered` flag; never recompute mastery client-side. */
export function MasteryBadge({ isMastered }: { isMastered: boolean }) {
  const { t } = useTranslation("learning");
  if (!isMastered) return null;
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-success/30 bg-success/10 text-success">
      <Trophy className="w-3 h-3" /> {t("flashcards.masteredLabel")}
    </Badge>
  );
}

export default MasteryBadge;
