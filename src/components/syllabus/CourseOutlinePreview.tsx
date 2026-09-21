import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  FileQuestion, 
  Brain,
  Sparkles,
  Edit3,
  CheckCircle2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Topic {
  id: string;
  title: string;
  durationMinutes: number;
  hasQuiz: boolean;
  hasFlashcards: boolean;
}

interface Chapter {
  id: string;
  title: string;
  topics: Topic[];
  estimatedMinutes: number;
}

interface CourseOutlinePreviewProps {
  courseName: string;
  chapters: Chapter[];
  onConfirm?: () => void;
  onEdit?: () => void;
}

export const CourseOutlinePreview = ({
  courseName,
  chapters,
  onConfirm,
  onEdit
}: CourseOutlinePreviewProps) => {
  const { t } = useTranslation("instructor");
  const { formatNumber, formatDuration } = useFormatters();
  const [expandedChapters, setExpandedChapters] = useState<string[]>(
    chapters.slice(0, 2).map(c => c.id)
  );

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => 
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const totalTopics = chapters.reduce((acc, ch) => acc + ch.topics.length, 0);
  const totalQuizzes = chapters.reduce(
    (acc, ch) => acc + ch.topics.filter(t => t.hasQuiz).length, 
    0
  );
  const totalFlashcards = chapters.reduce(
    (acc, ch) => acc + ch.topics.filter(t => t.hasFlashcards).length, 
    0
  );

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-card overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent flex-shrink-0">
            <Sparkles className="w-6 h-6 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs font-medium bg-accent/10 text-accent border-0">
                {t("syllabus.preview.badge")}
              </Badge>
            </div>
            <h2 className="text-xl font-bold">{courseName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("syllabus.preview.description")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-xl bg-card/80 text-center">
            <p className="text-2xl font-bold text-primary">{formatNumber(chapters.length)}</p>
            <p className="text-xs text-muted-foreground">{t("syllabus.preview.chapters")}</p>
          </div>
          <div className="p-3 rounded-xl bg-card/80 text-center">
            <p className="text-2xl font-bold text-success">{formatNumber(totalTopics)}</p>
            <p className="text-xs text-muted-foreground">{t("syllabus.preview.topics")}</p>
          </div>
          <div className="p-3 rounded-xl bg-card/80 text-center">
            <p className="text-2xl font-bold text-warning">{formatNumber(totalQuizzes + totalFlashcards)}</p>
            <p className="text-xs text-muted-foreground">{t("syllabus.preview.activities")}</p>
          </div>
        </div>
      </div>

      {/* Chapters List */}
      <div className="divide-y divide-border/50">
        {chapters.map((chapter, chapterIndex) => {
          const isExpanded = expandedChapters.includes(chapter.id);
          
          return (
            <div key={chapter.id}>
              {/* Chapter Header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-start"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {formatNumber(chapterIndex + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{chapter.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {t("syllabus.preview.topicsCount", { count: chapter.topics.length })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(chapter.estimatedMinutes * 60)}
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground rtl:rotate-180" />
                )}
              </button>

              {/* Topics */}
              {isExpanded && (
                <div className="pb-3 px-4 animate-fade-in">
                  <div className="ms-4 ps-4 border-s-2 border-border space-y-2">
                    {chapter.topics.map((topic, topicIndex) => (
                      <div 
                        key={topic.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {formatNumber(topicIndex + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{topic.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDuration(topic.durationMinutes * 60)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {topic.hasQuiz && (
                            <div className="p-1.5 rounded-lg bg-success/10" title={t("syllabus.preview.quizIncluded")}>
                              <FileQuestion className="w-3.5 h-3.5 text-success" />
                            </div>
                          )}
                          {topic.hasFlashcards && (
                            <div className="p-1.5 rounded-lg bg-warning/10" title={t("syllabus.preview.flashcardsIncluded")}>
                              <Brain className="w-3.5 h-3.5 text-warning" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Topic Button */}
                    <button className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors w-full text-sm text-muted-foreground hover:text-primary">
                      <Plus className="w-4 h-4" />
                      {t("syllabus.preview.addTopic")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border/50 bg-muted/30 flex flex-col sm:flex-row gap-3">
        <Button variant="outline" className="flex-1" onClick={onEdit}>
          <Edit3 className="w-4 h-4 me-2" />
          {t("syllabus.preview.editOutline")}
        </Button>
        <Button variant="gradient" className="flex-1" onClick={onConfirm}>
          <CheckCircle2 className="w-4 h-4 me-2" />
          {t("syllabus.preview.confirm")}
        </Button>
      </div>
    </div>
  );
};
