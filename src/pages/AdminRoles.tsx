import { AdminPageLayout } from "@/components/layout/AdminPageLayout";
import { RolesHeader } from "@/components/roles/RolesHeader";
import { RolesManager } from "@/components/roles/RolesManager";

const AdminRoles = () => (
    <AdminPageLayout>
        <RolesHeader />
        <RolesManager />
    </AdminPageLayout>
);

export default AdminRoles;
