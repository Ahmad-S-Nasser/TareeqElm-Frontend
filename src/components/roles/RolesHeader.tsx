import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export const RolesHeader = () => {
    const { t } = useTranslation("rbac");
    return (
        <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
    );
};
