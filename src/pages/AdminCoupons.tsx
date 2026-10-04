/**
 * Admin → Coupons (catalog v12's ownership-based split).
 *
 * A thin shell: the Admin sidebar/header layout, plus the shared `CouponsManager` body. The identical body is mounted
 * under the Organization shell by `OrganizationCoupons` — the backend scopes every coupon by ownership (Admin:
 * platform-owned coupons only; Organization: its own tenant's), so this page needs no scoping logic of its own.
 */
import { useState } from "react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { CouponsManager } from "@/components/billing/CouponsManager";
import { cn } from "@/lib/utils";

const AdminCoupons = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <CouponsManager />
                </div>
            </main>
        </div>
    );
};

export default AdminCoupons;
