import { UniversityPageLayout } from "@/components/layout/UniversityPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { UserCheck } from "lucide-react";

const UniversityEnrollment = () => {
    return (
        <UniversityPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-primary" />
                    </div>
                    Enrollment Management
                </h1>
                <p className="text-muted-foreground mt-1">Approve, reject, and track course enrollment requests</p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                    <p className="font-semibold">Not available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Trainers currently enroll in open courses directly, so there are no enrollment requests to review.
                    </p>
                </CardContent>
            </Card>
        </UniversityPageLayout>
    );
};

export default UniversityEnrollment;
