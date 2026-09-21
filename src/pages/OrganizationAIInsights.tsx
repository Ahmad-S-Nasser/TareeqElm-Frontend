import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Brain } from "lucide-react";

const OrganizationAIInsights = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-primary" />
                    </div>
                    {t('aiInsights.title')}
                </h1>
                <p className="text-muted-foreground mt-1">{t('aiInsights.subtitle')}</p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                    <p className="font-semibold">{t('notAvailable')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('aiInsights.body')}</p>
                </CardContent>
            </Card>
        </OrganizationPageLayout>
    );
};

export default OrganizationAIInsights;
