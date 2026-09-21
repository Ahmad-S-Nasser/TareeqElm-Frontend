import { UniversityPageLayout } from "@/components/layout/UniversityPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Brain } from "lucide-react";

const UniversityAIInsights = () => {
    return (
        <UniversityPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-primary" />
                    </div>
                    Academic Insights
                </h1>
                <p className="text-muted-foreground mt-1">Analysis of academic performance patterns across the platform</p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                    <p className="font-semibold">Not available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Automated insights are not available yet. Department performance is shown on the dashboard.</p>
                </CardContent>
            </Card>
        </UniversityPageLayout>
    );
};

export default UniversityAIInsights;
