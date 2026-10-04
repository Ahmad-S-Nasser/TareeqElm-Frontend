import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { MAX_COURSE_REFS, MAX_OUTCOMES, MAX_OUTCOME_LENGTH, MAX_TAGS, MAX_TAG_LENGTH, cleanTags } from "./courseMetadata";

interface TagsInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Chip input: type a tag and press Enter to add it; click a chip's x to remove it. */
export const TagsInput = ({ id, value, onChange }: TagsInputProps) => {
  const { t } = useTranslation("instructor");
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TAGS;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!draft.trim()) return;
    onChange(cleanTags([...value, draft]));
    setDraft("");
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("courseMeta.tags.label")}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="course-tags">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pe-1">
              <span>{tag}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={t("courseMeta.tags.remove", { tag })}
                onClick={() => onChange(value.filter((v) => v !== tag))}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        maxLength={MAX_TAG_LENGTH}
        disabled={full}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("courseMeta.tags.placeholder")}
      />
      <p className="text-xs text-muted-foreground">{t("courseMeta.tags.hint", { max: MAX_TAGS, length: MAX_TAG_LENGTH })}</p>
    </div>
  );
};

interface OutcomesInputProps {
  value: string[];
  onChange: (outcomes: string[]) => void;
}

/** Ordered "what you'll learn" list: one text input per row, add/remove buttons. */
export const OutcomesInput = ({ value, onChange }: OutcomesInputProps) => {
  const { t } = useTranslation("instructor");
  const update = (index: number, text: string) => onChange(value.map((o, i) => (i === index ? text : o)));

  return (
    <div className="grid gap-2">
      <Label>{t("courseMeta.outcomes.label")}</Label>
      <p className="text-xs text-muted-foreground">{t("courseMeta.outcomes.hint", { max: MAX_OUTCOMES })}</p>
      <div className="space-y-2" data-testid="course-outcomes">
        {value.map((outcome, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={outcome}
              maxLength={MAX_OUTCOME_LENGTH}
              aria-label={t("courseMeta.outcomes.itemLabel", { number: index + 1 })}
              placeholder={t("courseMeta.outcomes.placeholder")}
              onChange={(e) => update(index, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              aria-label={t("courseMeta.outcomes.remove", { number: index + 1 })}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" disabled={value.length >= MAX_OUTCOMES} onClick={() => onChange([...value, ""])}>
          <Plus className="w-4 h-4 me-1" /> {t("courseMeta.outcomes.add")}
        </Button>
      </div>
    </div>
  );
};

export interface CourseOption {
  Id: string;
  Title: string;
}

interface CoursePickerProps {
  id: string;
  title: string;
  help: string;
  options: CourseOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ids that may not be offered (the course being edited, and whatever the sibling picker already holds). */
  excludeIds?: string[];
  loading?: boolean;
  className?: string;
}

/** A searchable multi-select of courses: selected courses show as removable chips, matches as click-to-add rows. */
export const CoursePicker = ({ id, title, help, options, value, onChange, excludeIds = [], loading, className }: CoursePickerProps) => {
  const { t } = useTranslation("instructor");
  const [search, setSearch] = useState("");
  const titles = useMemo(() => new Map(options.map((o) => [o.Id, o.Title])), [options]);

  const matches = useMemo(() => {
    const hidden = new Set([...value, ...excludeIds]);
    const term = search.trim().toLowerCase();
    return options
      .filter((o) => !hidden.has(o.Id) && (!term || o.Title.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [options, value, excludeIds, search]);

  const full = value.length >= MAX_COURSE_REFS;

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", className)} data-testid={id}>
      <div>
        <Label htmlFor={`${id}-search`} className="text-base">{title}</Label>
        <p className="text-sm text-muted-foreground mt-1">{help}</p>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("courseMeta.picker.none")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((courseId) => {
            const label = titles.get(courseId) ?? t("courseMeta.picker.unknownCourse");
            return (
              <Badge key={courseId} variant="outline" className="gap-1 pe-1">
                <span>{label}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={t("courseMeta.picker.remove", { title: label })}
                  onClick={() => onChange(value.filter((v) => v !== courseId))}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <Input
        id={`${id}-search`}
        value={search}
        disabled={full}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("courseMeta.picker.search")}
      />
      {!full && (
        loading ? (
          <p className="text-xs text-muted-foreground">{t("courseMeta.picker.loading")}</p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("courseMeta.picker.empty")}</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto divide-y rounded-md border">
            {matches.map((o) => (
              <li key={o.Id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-muted/60"
                  aria-label={t("courseMeta.picker.add", { title: o.Title })}
                  onClick={() => { onChange([...value, o.Id]); setSearch(""); }}
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{o.Title}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};
