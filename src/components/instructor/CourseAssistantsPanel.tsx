import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiError, getApiErrorCode } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    COURSE_ASSISTANT_CAPABILITIES, COURSE_ASSISTANT_ERROR_CODES, type CourseAssistant, type CourseAssistantCapabilities,
    type CourseAssistantCapability, useAssignCourseAssistant, useCourseAssistantCandidatesQuery, useCourseAssistantsQuery,
    useRemoveCourseAssistant, useUpdateCourseAssistant,
} from "@/hooks/useCourseAssistants";

const DEFAULT_CAPABILITIES: CourseAssistantCapabilities = { CanGrade: true, CanManageAttendance: false, CanMessage: false };

/** Translation keys of each capability's label/hint, in the order the table shows them. */
const CAPABILITY_KEYS: Record<CourseAssistantCapability, string> = {
    CanGrade: "grade",
    CanManageAttendance: "attendance",
    CanMessage: "message",
};

interface CourseAssistantsPanelProps {
    courseId: string;
}

/**
 * The course editor's "Teaching assistants" tab: who assists this course, with one switch per capability (each flag is
 * granted on its own), a remove action, and an "Add assistant" picker over the organization's other instructors.
 */
export const CourseAssistantsPanel = ({ courseId }: CourseAssistantsPanelProps) => {
    const { t } = useTranslation("instructor");
    const { toast } = useToast();
    const assistants = useCourseAssistantsQuery(courseId);
    const assign = useAssignCourseAssistant(courseId);
    const update = useUpdateCourseAssistant(courseId);
    const remove = useRemoveCourseAssistant(courseId);

    const [addOpen, setAddOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [newCapabilities, setNewCapabilities] = useState<CourseAssistantCapabilities>(DEFAULT_CAPABILITIES);
    const [removing, setRemoving] = useState<CourseAssistant | null>(null);

    const candidates = useCourseAssistantCandidatesQuery(courseId, addOpen);
    const matches = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (candidates.data ?? [])
            .filter((c) => !term || c.Name.toLowerCase().includes(term) || c.Email.toLowerCase().includes(term))
            .slice(0, 8);
    }, [candidates.data, search]);
    const selected = (candidates.data ?? []).find((c) => c.UserId === selectedId) ?? null;

    /** The UI's own copy for a known assistant error code, otherwise the server's (already localized) message. */
    const errorText = (error: unknown) => {
        const code = getApiErrorCode(error);
        return code && (COURSE_ASSISTANT_ERROR_CODES as readonly string[]).includes(code)
            ? t(`assistants.errors.${code.replace("course_assistant.", "")}`)
            : getApiError(error);
    };

    const openAdd = () => {
        setSearch("");
        setSelectedId(null);
        setNewCapabilities(DEFAULT_CAPABILITIES);
        setAddOpen(true);
    };

    const handleAssign = async () => {
        if (!selectedId) return;
        try {
            await assign.mutateAsync({ UserId: selectedId, ...newCapabilities });
            toast({ title: t("assistants.added") });
            setAddOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: t("assistants.addFailed"), description: errorText(error) });
        }
    };

    const handleToggle = async (assistant: CourseAssistant, capability: CourseAssistantCapability, value: boolean) => {
        try {
            await update.mutateAsync({
                id: assistant.Id,
                CanGrade: assistant.CanGrade,
                CanManageAttendance: assistant.CanManageAttendance,
                CanMessage: assistant.CanMessage,
                [capability]: value,
            });
        } catch (error) {
            toast({ variant: "destructive", title: t("assistants.updateFailed"), description: errorText(error) });
        }
    };

    const handleRemove = async () => {
        if (!removing) return;
        const target = removing;
        setRemoving(null);
        try {
            await remove.mutateAsync(target.Id);
            toast({ title: t("assistants.removed") });
        } catch (error) {
            toast({ variant: "destructive", title: t("assistants.removeFailed"), description: errorText(error) });
        }
    };

    const displayName = (a: { Name: string | null; Email: string | null }) => a.Name ?? a.Email ?? t("assistants.unknownUser");
    const rows = assistants.data ?? [];

    return (
        <div className="space-y-4" data-testid="course-assistants">
            <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-muted-foreground">{t("assistants.help")}</p>
                <Button type="button" onClick={openAdd} className="shrink-0">
                    <UserPlus className="w-4 h-4 me-2" />
                    {t("assistants.add")}
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t("assistants.columns.assistant")}</TableHead>
                        {COURSE_ASSISTANT_CAPABILITIES.map((c) => (
                            <TableHead key={c} className="text-center">{t(`assistants.capabilities.${CAPABILITY_KEYS[c]}.label`)}</TableHead>
                        ))}
                        <TableHead className="text-end">{t("assistants.columns.actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {assistants.isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline text-primary" /></TableCell></TableRow>
                    ) : assistants.isError ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-destructive">{getApiError(assistants.error, t("assistants.loadFailed"))}</TableCell></TableRow>
                    ) : rows.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("assistants.empty")}</TableCell></TableRow>
                    ) : rows.map((a) => (
                        <TableRow key={a.Id} data-testid={`assistant-row-${a.UserId}`}>
                            <TableCell>
                                <p className="font-medium">{displayName(a)}</p>
                                {a.Email && <p className="text-xs text-muted-foreground">{a.Email}</p>}
                            </TableCell>
                            {COURSE_ASSISTANT_CAPABILITIES.map((c) => (
                                <TableCell key={c} className="text-center">
                                    <Switch
                                        checked={a[c]}
                                        disabled={update.isPending}
                                        aria-label={t(`assistants.capabilities.${CAPABILITY_KEYS[c]}.toggle`, { name: displayName(a) })}
                                        onCheckedChange={(value) => handleToggle(a, c, value)}
                                    />
                                </TableCell>
                            ))}
                            <TableCell className="text-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    aria-label={t("assistants.remove", { name: displayName(a) })}
                                    onClick={() => setRemoving(a)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("assistants.dialog.title")}</DialogTitle>
                        <DialogDescription>{t("assistants.dialog.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="assistant-search">{t("assistants.dialog.searchLabel")}</Label>
                            <Input
                                id="assistant-search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t("assistants.dialog.searchPlaceholder")}
                            />
                            {candidates.isLoading ? (
                                <p className="text-xs text-muted-foreground">{t("assistants.dialog.loading")}</p>
                            ) : candidates.isError ? (
                                <p className="text-xs text-destructive">{getApiError(candidates.error, t("assistants.dialog.loadFailed"))}</p>
                            ) : matches.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t("assistants.dialog.empty")}</p>
                            ) : (
                                <ul className="max-h-48 overflow-y-auto divide-y rounded-md border">
                                    {matches.map((c) => (
                                        <li key={c.UserId}>
                                            <button
                                                type="button"
                                                aria-pressed={c.UserId === selectedId}
                                                aria-label={t("assistants.dialog.choose", { name: c.Name })}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-muted/60",
                                                    c.UserId === selectedId && "bg-primary/10")}
                                                onClick={() => setSelectedId(c.UserId)}
                                            >
                                                {c.UserId === selectedId
                                                    ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    : <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                                <span className="truncate">{c.Name}</span>
                                                <span className="truncate text-xs text-muted-foreground ms-auto">{c.Email}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {selected && (
                            <p className="text-sm" data-testid="assistant-selected">{t("assistants.dialog.selected", { name: selected.Name })}</p>
                        )}

                        <div className="space-y-3">
                            {COURSE_ASSISTANT_CAPABILITIES.map((c) => (
                                <div key={c} className="flex items-center justify-between gap-4">
                                    <div>
                                        <Label htmlFor={`new-assistant-${c}`}>{t(`assistants.capabilities.${CAPABILITY_KEYS[c]}.label`)}</Label>
                                        <p className="text-xs text-muted-foreground">{t(`assistants.capabilities.${CAPABILITY_KEYS[c]}.hint`)}</p>
                                    </div>
                                    <Switch
                                        id={`new-assistant-${c}`}
                                        checked={newCapabilities[c]}
                                        onCheckedChange={(value) => setNewCapabilities((prev) => ({ ...prev, [c]: value }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("assistants.dialog.cancel")}</Button>
                        <Button type="button" onClick={handleAssign} disabled={!selectedId || assign.isPending}>
                            {assign.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("assistants.dialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("assistants.removeDialog.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("assistants.removeDialog.description", { name: removing ? displayName(removing) : "" })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("assistants.removeDialog.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove}>{t("assistants.removeDialog.confirm")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
