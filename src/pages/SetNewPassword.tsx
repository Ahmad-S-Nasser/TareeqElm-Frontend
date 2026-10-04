import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { roleHome } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import logo from "@/assets/logo.png";

const PASSWORD_MIN_LENGTH = 8;

/** Forced for an admin/org-created account on first login (MustChangePassword): the password it was handed must be
 * changed before any dashboard is reachable — RoleGuard redirects here until this succeeds. */
const SetNewPassword = () => {
    const { t } = useTranslation(["auth", "common"]);
    const { role, refreshUser } = useAuth();
    const { changePassword } = useProfile();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!current) {
            setError(t("auth:setPassword.currentRequired"));
            return;
        }
        if (next.length < PASSWORD_MIN_LENGTH) {
            setError(t("auth:validation.passwordMin", { count: PASSWORD_MIN_LENGTH }));
            return;
        }
        if (next !== confirm) {
            setError(t("auth:setPassword.mismatch"));
            return;
        }

        setIsSubmitting(true);
        try {
            await changePassword.mutateAsync({ CurrentPassword: current, NewPassword: next });
            await refreshUser(); // picks up MustChangePassword: false so RoleGuard stops redirecting here
            toast({ title: t("auth:setPassword.successTitle") });
            navigate(roleHome(role), { replace: true });
        } catch (err) {
            toast({ variant: "destructive", title: t("auth:setPassword.failedTitle"), description: getApiError(err) });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
                        <img src={logo} alt="" className="w-16 h-16 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold">{t("common:appName")}</h1>
                </div>

                <Card className="border-border/50 shadow-soft">
                    <CardHeader className="text-center">
                        <CardTitle>{t("auth:setPassword.title")}</CardTitle>
                        <CardDescription>{t("auth:setPassword.subtitle")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="current-password">{t("auth:setPassword.currentLabel")}</Label>
                                <Input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                                    placeholder={t("auth:setPassword.currentPlaceholder")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">{t("auth:setPassword.newLabel")}</Label>
                                <Input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)}
                                    placeholder={t("auth:setPassword.newPlaceholder")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">{t("auth:setPassword.confirmLabel")}</Label>
                                <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                    placeholder={t("auth:setPassword.confirmPlaceholder")} />
                            </div>
                            {error && <p className="text-xs text-destructive">{error}</p>}
                            <Button type="submit" className="w-full" variant="gradient" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("auth:setPassword.submitting")}</>
                                ) : t("auth:setPassword.submit")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SetNewPassword;
