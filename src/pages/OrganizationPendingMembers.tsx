/**
 * Organization → Pending members: Trainees who requested to join without a join code (`pending-members.manage`).
 * Approve flips them to active (they can log in immediately after); reject deletes the pending account — it never had
 * real access, so there's no state to keep, and the person can simply try again (e.g. with the right org or a code).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCheck, Check, X, Loader2 } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
    useApprovePendingMember, usePendingMembersQuery, useRejectPendingMember, type PendingMemberDto,
} from "@/hooks/useOrganizationPendingMembers";

const OrganizationPendingMembers = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate } = useFormatters();
    const { toast } = useToast();
    const { data: members = [], isLoading, isError, error, isFetching } = usePendingMembersQuery();
    const approve = useApprovePendingMember();
    const reject = useRejectPendingMember();
    const [rejecting, setRejecting] = useState<PendingMemberDto | null>(null);

    const handleApprove = async (member: PendingMemberDto) => {
        try {
            await approve.mutateAsync(member.Id);
            toast({ title: t("organization:pendingMembers.approved", { name: member.FullName }) });
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:pendingMembers.approveFailed"), description: getApiError(err) });
        }
    };

    const confirmReject = async () => {
        if (!rejecting) return;
        try {
            await reject.mutateAsync(rejecting.Id);
            toast({ title: t("organization:pendingMembers.rejected", { name: rejecting.FullName }) });
            setRejecting(null);
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:pendingMembers.rejectFailed"), description: getApiError(err) });
            setRejecting(null);
        }
    };

    return (
        <OrganizationPageLayout>
            <div className="animate-slide-up">
                <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
                    <UserCheck className="h-8 w-8 text-primary" aria-hidden="true" />
                    {t("organization:pendingMembers.title")}
                </h1>
                <p className="mt-1 text-muted-foreground">{t("organization:pendingMembers.subtitle")}</p>
            </div>

            <Can
                permission={PERMISSIONS.pendingMembersManage}
                fallback={
                    <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                        {t("organization:pendingMembers.noAccess")}
                    </p>
                }
            >
                <Card className="border-border/50">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50 bg-muted/30">
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:pendingMembers.columns.name")}</th>
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("organization:pendingMembers.columns.requestedAt")}</th>
                                        <th className="text-end px-5 py-3 font-semibold text-muted-foreground">{t("organization:pendingMembers.columns.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && (
                                        <tr><td colSpan={3} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                    )}
                                    {isError && (
                                        <tr><td colSpan={3} className="text-center py-12 text-destructive">{getApiError(error, t("organization:pendingMembers.loadFailed"))}</td></tr>
                                    )}
                                    {!isLoading && !isError && members.map((member) => (
                                        <tr key={member.Id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isFetching ? "opacity-70" : ""}`}>
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold">{member.FullName}</p>
                                                <p dir="ltr" className="text-xs text-muted-foreground text-start">{member.Email}</p>
                                            </td>
                                            <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{formatDate(member.RequestedAt)}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm" onClick={() => void handleApprove(member)}
                                                        disabled={approve.isPending || reject.isPending}
                                                    >
                                                        {approve.isPending && approve.variables === member.Id ? (
                                                            <Loader2 className="h-4 w-4 me-1 animate-spin" />
                                                        ) : <Check className="h-4 w-4 me-1" />}
                                                        {t("organization:pendingMembers.approve")}
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="outline" onClick={() => setRejecting(member)}
                                                        disabled={approve.isPending || reject.isPending}
                                                    >
                                                        <X className="h-4 w-4 me-1" />
                                                        {t("organization:pendingMembers.reject")}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoading && !isError && members.length === 0 && (
                                        <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">{t("organization:pendingMembers.empty")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </Can>

            <AlertDialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("organization:pendingMembers.confirmRejectTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("organization:pendingMembers.confirmRejectDescription", { name: rejecting?.FullName ?? "" })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void confirmReject()}>{t("organization:pendingMembers.reject")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationPendingMembers;
