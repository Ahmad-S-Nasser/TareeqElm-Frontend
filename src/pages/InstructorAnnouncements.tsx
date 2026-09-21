import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Megaphone, Plus, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockAnnouncements = [
  { id: 1, title: "Midterm Exam Schedule Released", course: "ML 101", date: "Mar 8, 2026", content: "The midterm exam will be held on March 15th. Please review chapters 1-5." },
  { id: 2, title: "New Assignment Posted", course: "Statistics", date: "Mar 7, 2026", content: "A new data analysis assignment has been posted. Due by March 20th." },
  { id: 3, title: "Guest Lecture This Friday", course: "Business Strategy", date: "Mar 5, 2026", content: "We'll have a guest speaker from Google discussing AI strategy." },
  { id: 4, title: "Office Hours Change", course: "ML 101", date: "Mar 3, 2026", content: "Office hours will be moved to Thursday 2-4 PM this week." },
];

const InstructorAnnouncements = () => {
  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Announcements</h1>
            </div>
            <p className="text-muted-foreground">Post updates and reminders to your trainers</p>
          </div>
          <Button className="gradient-accent text-white shadow-glow-accent">
            <Plus className="w-4 h-4 mr-2" /> New Announcement
          </Button>
        </div>
      </section>

      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {mockAnnouncements.map((a) => (
          <Card key={a.id} className="shadow-soft border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{a.title}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> {a.date}
                </div>
              </div>
              <Badge variant="outline" className="text-xs mb-3">
                <BookOpen className="w-3 h-3 mr-1" /> {a.course}
              </Badge>
              <p className="text-sm text-muted-foreground">{a.content}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorAnnouncements;
