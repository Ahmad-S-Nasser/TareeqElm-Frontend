import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Megaphone, Plus, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockAnnouncements = [
  { id: 1, date: "2026-03-08" },
  { id: 2, date: "2026-03-07" },
  { id: 3, date: "2026-03-05" },
  { id: 4, date: "2026-03-03" },
];

const InstructorAnnouncements = () => {
  const { t } = useTranslation("instructor");
  const { formatDate } = useFormatters();
  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("announcements.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("announcements.subtitle")}</p>
          </div>
          <Button className="gradient-accent text-white shadow-glow-accent">
            <Plus className="w-4 h-4 me-2" /> {t("announcements.new")}
          </Button>
        </div>
      </section>

      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {mockAnnouncements.map((a) => (
          <Card key={a.id} className="shadow-soft border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{t(`announcements.items.${a.id}.title`)}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> {formatDate(a.date)}
                </div>
              </div>
              <Badge variant="outline" className="text-xs mb-3">
                <BookOpen className="w-3 h-3 me-1" /> {t(`announcements.items.${a.id}.course`)}
              </Badge>
              <p className="text-sm text-muted-foreground">{t(`announcements.items.${a.id}.content`)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorAnnouncements;
