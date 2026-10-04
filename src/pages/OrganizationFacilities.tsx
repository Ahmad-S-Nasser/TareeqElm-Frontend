import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Search,
    Plus,
    Warehouse,
    DoorOpen,
    MapPin,
    MoreVertical,
    Trash2,
    Users,
    Loader2,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Building { Id: string; Name: string; Code: string | null; Address: string | null; RoomsCount: number }
interface Room { Id: string; BuildingId: string; Name: string; Code: string | null; Capacity: number | null }

const OrganizationFacilities = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
    const [newBuilding, setNewBuilding] = useState({ name: "", code: "", address: "" });
    const [roomsBuilding, setRoomsBuilding] = useState<Building | null>(null);
    const [newRoom, setNewRoom] = useState({ name: "", code: "", capacity: "" });
    const { t } = useTranslation(["organization", "common"]);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: buildings = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-facilities"],
        queryFn: async () => (await api.get<Building[]>("/facilities/buildings")).data,
    });

    const invalidateBuildings = () => queryClient.invalidateQueries({ queryKey: ["organization-facilities"] });

    const addBuildingMutation = useMutation({
        mutationFn: async (b: { Name: string; Code?: string; Address?: string }) => { await api.post("/facilities/buildings", b); },
        onSuccess: () => {
            invalidateBuildings();
            setIsAddBuildingOpen(false);
            setNewBuilding({ name: "", code: "", address: "" });
            toast({ title: t("facilities.buildingCreated") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("facilities.buildingCreateFailed")) }),
    });

    const deleteBuildingMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/facilities/buildings/${id}`); },
        onSuccess: () => { invalidateBuildings(); toast({ title: t("facilities.buildingDeleted") }); },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("facilities.buildingDeleteFailed")) }),
    });

    const handleAddBuilding = () => {
        if (!newBuilding.name.trim()) {
            toast({ variant: "destructive", title: t("facilities.buildingNameRequired") });
            return;
        }
        addBuildingMutation.mutate({
            Name: newBuilding.name.trim(),
            Code: newBuilding.code.trim() || undefined,
            Address: newBuilding.address.trim() || undefined,
        });
    };

    const filteredBuildings = buildings.filter((b) =>
        b.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.Code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ---------- rooms (of the building currently open in the dialog) ----------

    const { data: rooms = [], isLoading: roomsLoading, isError: roomsError } = useQuery({
        queryKey: ["organization-facility-rooms", roomsBuilding?.Id],
        queryFn: async () => (await api.get<Room[]>(`/facilities/buildings/${roomsBuilding!.Id}/rooms`)).data,
        enabled: !!roomsBuilding,
    });

    const invalidateRooms = () => {
        queryClient.invalidateQueries({ queryKey: ["organization-facility-rooms", roomsBuilding?.Id] });
        invalidateBuildings(); // RoomsCount on the building card
    };

    const addRoomMutation = useMutation({
        mutationFn: async (r: { Name: string; Code?: string; Capacity?: number }) => {
            await api.post(`/facilities/buildings/${roomsBuilding!.Id}/rooms`, r);
        },
        onSuccess: () => {
            invalidateRooms();
            setNewRoom({ name: "", code: "", capacity: "" });
            toast({ title: t("facilities.roomCreated") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("facilities.roomCreateFailed")) }),
    });

    const deleteRoomMutation = useMutation({
        mutationFn: async (roomId: string) => { await api.delete(`/facilities/buildings/${roomsBuilding!.Id}/rooms/${roomId}`); },
        onSuccess: () => { invalidateRooms(); toast({ title: t("facilities.roomDeleted") }); },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("facilities.roomDeleteFailed")) }),
    });

    const handleAddRoom = () => {
        if (!newRoom.name.trim()) {
            toast({ variant: "destructive", title: t("facilities.roomNameRequired") });
            return;
        }
        const capacity = newRoom.capacity.trim() ? Number(newRoom.capacity) : undefined;
        addRoomMutation.mutate({ Name: newRoom.name.trim(), Code: newRoom.code.trim() || undefined, Capacity: capacity });
    };

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t("facilities.title")}</h1>
                            <p className="text-muted-foreground mt-1">{t("facilities.subtitle")}</p>
                        </div>
                        <Button className="gradient-primary text-white border-0" onClick={() => setIsAddBuildingOpen(true)}>
                            <Plus className="w-4 h-4 me-2" />
                            {t("facilities.addBuilding")}
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("facilities.search")}
                                className="ps-10 bg-background/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isError && (
                        <div className="text-center py-6 text-destructive">{getApiError(error, t("facilities.loadFailed"))}</div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredBuildings.map((building) => (
                                <Card key={building.Id} className="group hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden">
                                    <CardHeader className="pb-4 relative">
                                        <div className="flex items-start justify-between">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                                <Warehouse className="w-6 h-6" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("facilities.actionsMenu")}>
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => { if (window.confirm(t("facilities.confirmDeleteBuilding", { name: building.Name }))) deleteBuildingMutation.mutate(building.Id); }}
                                                    >
                                                        <Trash2 className="w-4 h-4 me-2" /> {t("common:actions.delete")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-xl">{building.Name}</CardTitle>
                                        {building.Address && (
                                            <CardDescription className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {building.Address}
                                            </CardDescription>
                                        )}
                                        {building.Code && (
                                            <CardDescription>{t("facilities.code", { code: building.Code })}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <DoorOpen className="w-4 h-4 text-primary" />
                                            <span className="font-bold">{building.RoomsCount}</span>
                                            <span className="text-muted-foreground">{t("facilities.rooms")}</span>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            className="w-full group/btn hover:bg-primary/5 hover:text-primary border border-transparent hover:border-primary/20"
                                            onClick={() => setRoomsBuilding(building)}
                                        >
                                            {t("facilities.manageRooms")}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredBuildings.length === 0 && (
                        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
                            <Warehouse className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">{t("facilities.noneFound")}</h3>
                            <p className="text-muted-foreground">{t("facilities.noneHint")}</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Add building */}
            <Dialog open={isAddBuildingOpen} onOpenChange={setIsAddBuildingOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t("facilities.addBuildingTitle")}</DialogTitle>
                        <DialogDescription>{t("facilities.addBuildingDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="building-name">{t("facilities.buildingName")}</Label>
                            <Input id="building-name" placeholder={t("facilities.buildingNamePlaceholder")} value={newBuilding.name} onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="building-code">{t("facilities.buildingCode")}</Label>
                            <Input id="building-code" placeholder={t("facilities.buildingCodePlaceholder")} value={newBuilding.code} onChange={(e) => setNewBuilding({ ...newBuilding, code: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="building-address">{t("facilities.address")}</Label>
                            <Input id="building-address" placeholder={t("facilities.addressPlaceholder")} value={newBuilding.address} onChange={(e) => setNewBuilding({ ...newBuilding, address: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddBuildingOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleAddBuilding} disabled={addBuildingMutation.isPending} className="gradient-primary text-white border-0">
                            {addBuildingMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("facilities.addBuilding")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage rooms of one building */}
            <Dialog open={!!roomsBuilding} onOpenChange={(open) => { if (!open) setRoomsBuilding(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{roomsBuilding && t("facilities.roomsOf", { name: roomsBuilding.Name })}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="room-name">{t("facilities.roomName")}</Label>
                                <Input id="room-name" placeholder={t("facilities.roomNamePlaceholder")} value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} />
                            </div>
                            <div className="w-24 space-y-2">
                                <Label htmlFor="room-capacity">{t("facilities.capacity")}</Label>
                                <Input id="room-capacity" type="number" min={1} placeholder={t("facilities.capacityPlaceholder")} value={newRoom.capacity} onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })} />
                            </div>
                            <Button onClick={handleAddRoom} disabled={addRoomMutation.isPending} className="gradient-primary text-white border-0">
                                {addRoomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </Button>
                        </div>

                        {roomsError && <div className="text-center py-4 text-destructive text-sm">{t("facilities.loadRoomsFailed")}</div>}

                        {roomsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <p className="font-medium text-foreground">{t("facilities.noRoomsFound")}</p>
                                <p>{t("facilities.noRoomsHint")}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
                                {rooms.map((room) => (
                                    <li key={room.Id} className="flex items-center justify-between px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <DoorOpen className="w-4 h-4 text-primary" />
                                            <span className="font-medium">{room.Name}</span>
                                            {room.Capacity != null && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> {room.Capacity}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                            aria-label={t("common:actions.delete")}
                                            onClick={() => { if (window.confirm(t("facilities.confirmDeleteRoom", { name: room.Name }))) deleteRoomMutation.mutate(room.Id); }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoomsBuilding(null)}>{t("facilities.close")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationFacilities;
