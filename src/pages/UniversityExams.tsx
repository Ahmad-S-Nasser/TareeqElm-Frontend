import { UniversityPageLayout } from "@/components/layout/UniversityPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

const UniversityExams = () => {
    return (
        <UniversityPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-primary" />
                    </div>
                    Exams Management
                </h1>
                <p className="text-muted-foreground mt-1">Schedule exams, track grades and pass rates</p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                    <p className="font-semibold">Not available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Exam scheduling and grading are not part of the platform yet. Quiz results are available to instructors on their own courses.</p>
                </CardContent>
            </Card>
        </UniversityPageLayout>
    );
};

export default UniversityExams;
