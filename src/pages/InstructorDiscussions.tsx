import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { MessageSquare, Pin, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const HOUR = 3600 * 1000;
const mockDiscussions = [
  { id: 1, author: "Sarah M.", replies: 8, pinned: true, hoursAgo: 2 },
  { id: 2, author: "Ahmed K.", replies: 12, pinned: true, hoursAgo: 4 },
  { id: 3, author: "Lisa W.", replies: 5, pinned: false, hoursAgo: 6 },
  { id: 4, author: "John D.", replies: 3, pinned: false, hoursAgo: 24 },
  { id: 5, author: "Omar H.", replies: 15, pinned: false, hoursAgo: 26 },
];

const InstructorDiscussions = () => {
  const { t } = useTranslation("instructor");
  const { formatNumber, formatRelativeTime } = useFormatters();
  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("discussions.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("discussions.subtitle")}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {mockDiscussions.map((row) => ({ ...row, at: Date.now() - row.hoursAgo * HOUR })).map((d) => (
          <Card key={d.id} className="shadow-soft border-border/50 hover:shadow-elevated transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="w-9 h-9 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{d.author.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {d.pinned && <Pin className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                    <h3 className="font-medium text-sm truncate">{t(`discussions.items.${d.id}.title`)}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{d.author}</span>
                    <Badge variant="outline" className="text-[10px]">{t(`discussions.items.${d.id}.course`)}</Badge>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(d.replies)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(d.at)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorDiscussions;
