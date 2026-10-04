/**
 * Admin → Payouts (catalog v12's ownership-based split).
 *
 * A thin shell: the Admin sidebar/header layout, plus the shared `PayoutsManager` body. The identical body is mounted
 * under the Organization shell by `OrganizationPayouts` — the backend scopes every payout and instructor by ownership
 * (Admin: platform instructors only; Organization: its own tenant's), so this page needs no scoping logic of its own.
 */
import { useState } from "react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { PayoutsManager } from "@/components/billing/PayoutsManager";
import { cn } from "@/lib/utils";

const AdminPayouts = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <PayoutsManager />
                </div>
            </main>
        </div>
    );
};

export default AdminPayouts;
