import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog, DialogContent
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, BookOpen, GraduationCap, Brain, Users, Building2,
  FileText, ArrowRight
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "course" | "lesson" | "flashcard" | "instructor" | "trainer" | "department";
  url: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string }> = {
  course: { icon: BookOpen, color: "text-primary" },
  lesson: { icon: FileText, color: "text-emerald-500" },
  flashcard: { icon: Brain, color: "text-accent" },
  instructor: { icon: GraduationCap, color: "text-amber-500" },
  trainer: { icon: Users, color: "text-blue-500" },
  department: { icon: Building2, color: "text-rose-500" },
};

const MOCK_DATA: SearchResult[] = [
  { id: "1", title: "", subtitle: "", category: "course", url: "/courses" },
  { id: "2", title: "", subtitle: "", category: "course", url: "/courses" },
  { id: "3", title: "", subtitle: "", category: "course", url: "/courses" },
  { id: "4", title: "", subtitle: "", category: "lesson", url: "/courses" },
  { id: "5", title: "", subtitle: "", category: "lesson", url: "/courses" },
  { id: "6", title: "", subtitle: "", category: "flashcard", url: "/flashcards" },
  { id: "7", title: "", subtitle: "", category: "flashcard", url: "/spaced-repetition" },
  { id: "8", title: "", subtitle: "", category: "instructor", url: "/catalog" },
  { id: "9", title: "", subtitle: "", category: "instructor", url: "/catalog" },
  { id: "10", title: "", subtitle: "", category: "department", url: "/catalog" },
  { id: "11", title: "", subtitle: "", category: "department", url: "/catalog" },
];

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearchDialog = ({ open, onOpenChange }: GlobalSearchDialogProps) => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation("nav");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return MOCK_DATA.map(r => ({
      ...r,
      title: t(`search.items.${r.id}.title`),
      subtitle: t(`search.items.${r.id}.subtitle`),
    })).filter(r => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q));
  }, [query, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach(r => {
      const arr = map.get(r.category) || [];
      arr.push(r);
      map.set(r.category, arr);
    });
    return map;
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    navigate(result.url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 h-14 text-base"
            autoFocus
          />
          <kbd dir="ltr" className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            {t("search.esc")}
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t("search.noResults")}</p>
              <p className="text-sm">{t("search.tryDifferent")}</p>
            </div>
          )}

          {!query.trim() && (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">{t("search.startTyping")}</p>
              <p className="text-xs mt-1">{t("search.tip", { shortcut: t("header.searchShortcut") })}</p>
            </div>
          )}

          {Array.from(grouped).map(([category, items]) => {
            const config = categoryConfig[category];
            return (
              <div key={category} className="mb-2">
                <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{t(`search.categories.${category}`)}</p>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-start group"
                  >
                    <div className={cn("w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0")}>
                      <config.icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground rtl:rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
