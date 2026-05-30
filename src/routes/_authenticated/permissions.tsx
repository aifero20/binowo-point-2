import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/permissions")({ component: PermissionsPage });

const ROLES = ["OWNER", "ADMIN", "SUPERVISOR", "KASIR"];
const MENU_ORDER = ["DASHBOARD","SHIFT_KASIR","PENJUALAN","CUSTOMER","RETUR","PEMBELIAN","SUPPLIER","HUTANG_SUPPLIER","MASTER_BARANG","GUDANG","LAPORAN","MANAJEMEN_USER","PERMISSION_MATRIX"];

type Permission = { id: string; menu_code: string; menu_name: string };
type RolePermission = { id: string; role_code: string; permission_id: string; is_active: boolean };

function PermissionsPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();

  if (!roles.includes("owner") && !roles.includes("admin")) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Akses ditolak. Halaman ini hanya untuk OWNER & ADMIN.
      </div>
    );
  }

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*");
      if (error) throw error;
      return data as Permission[];
    },
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ roleCode, permId, current }: { roleCode: string; permId: string; current: RolePermission | undefined }) => {
      if (current) {
        const { error } = await supabase.from("role_permissions").update({ is_active: !current.is_active }).eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").insert({ role_code: roleCode, permission_id: permId, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["role_permissions"] }); toast.success("Akses diperbarui"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sorted = [...permissions].sort((a, b) => MENU_ORDER.indexOf(a.menu_code) - MENU_ORDER.indexOf(b.menu_code));

  function getRP(roleCode: string, permId: string) {
    return rolePerms.find(rp => rp.role_code === roleCode && rp.permission_id === permId);
  }

  function isActive(roleCode: string, permId: string) {
    const rp = getRP(roleCode, permId);
    return rp?.is_active ?? false;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">Atur akses menu per role. Hanya OWNER & ADMIN yang dapat mengubah.</p>
        </div>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium w-48">Menu</th>
              {ROLES.map(role => (
                <th key={role} className="px-4 py-3 text-center font-medium">
                  <Badge variant={role === "OWNER" ? "default" : role === "ADMIN" ? "default" : "outline"}>{role}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((perm, i) => (
              <tr key={perm.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="px-4 py-3 font-medium">{perm.menu_name}</td>
                {ROLES.map(role => {
                  const locked = (role === "OWNER") || (role === "ADMIN" && perm.menu_code === "PERMISSION_MATRIX");
                  const active = locked ? true : isActive(role, perm.id);
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <Switch
                        checked={active}
                        disabled={locked || toggle.isPending}
                        onCheckedChange={() => {
                          if (locked) return;
                          toggle.mutate({ roleCode: role, permId: perm.id, current: getRP(role, perm.id) });
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
