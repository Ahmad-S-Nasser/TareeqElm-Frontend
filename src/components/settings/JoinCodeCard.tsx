import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useOrganizationProfile, useRegenerateJoinCode } from "@/hooks/useOrganization";

interface JoinCodeCardProps {
    /** `settings.manage` — the same gate the regenerate endpoint requires. */
    canManage: boolean;
}

/** The code a Trainee enters at signup to join this org immediately, with no approval step. */
export const JoinCodeCard = ({ canManage }: JoinCodeCardProps) => {
    const { t } = useTranslation("organization");
    const { toast } = useToast();
    const { profile, isLoading } = useOrganizationProfile();
    const regenerate = useRegenerateJoinCode();
    const [copied, setCopied] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleCopy = async () => {
        if (!profile?.JoinCode) return;
        try {
            await navigator.clipboard.writeText(profile.JoinCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable; the code is still shown on screen */ }
    };

    const handleRegenerate = async () => {
        try {
            await regenerate.mutateAsync();
            setConfirmOpen(false);
            toast({ title: t("settings.joinCode.regenerated") });
        } catch (err) {
            toast({ variant: "destructive", title: t("settings.joinCode.regenerateFailed"), description: getApiError(err) });
        }
    };

    return (
        <Card className="border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="w-5 h-5 text-primary" />{t("settings.joinCode.title")}</CardTitle>
                <CardDescription>{t("settings.joinCode.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 max-w-xs">
                            <code dir="ltr" className="text-lg font-mono font-semibold tracking-wider">{profile?.JoinCode}</code>
                            <Button type="button" variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={handleCopy} aria-label={t("settings.joinCode.copy")}>
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                        {canManage && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={regenerate.isPending}>
                                {regenerate.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RefreshCw className="w-4 h-4 me-2" />}
                                {t("settings.joinCode.regenerate")}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("settings.joinCode.confirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("settings.joinCode.confirmDescription")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("settings.joinCode.confirmCancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate}>{t("settings.joinCode.confirmAction")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};
