import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/permissions")({ component: PermissionsPage });

const ROLES = ["OWNER", "ADMIN", "SUPERVISOR", "KASIR"];

type Permission = { id: string; menu_code: string; menu_name: string };
type RolePermission = { role_code: string; permission_id: string; is_active: boolean };

function PermissionsPage() {
  const qc = useQueryClient();

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*").order("menu_name");
      if (error) throw error;
      return data as Permission[];
    },
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ role_code, permission_id, currently_active }: { role_code: string; permission_id: string; currently_active: boolean }) => {
      const existing = rolePerms.find((rp) => rp.role_code === role_code && rp.permission_id === permission_id);
      if (existing) {
        const { error } = await supabase.from("role_permissions").update({ is_active: !currently_active } as never).eq("role_code", role_code).eq("permission_id", permission_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").insert({ role_code, permission_id, is_active: true } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function isActive(role_code: string, permission_id: string) {
    const rp = rolePerms.find((r) => r.role_code === role_code && r.permission_id === permission_id);
    return rp?.is_active ?? false;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Permission Matrix</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Menu</th>
                {ROLES.map((r) => <th key={r} className="p-3 text-center font-medium w-24">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b hover:bg-accent/30">
                  <td className="p-3 font-medium">{p.menu_name}<span className="text-xs text-muted-foreground ml-2">({p.menu_code})</span></td>
                  {ROLES.map((role) => {
                    const active = isActive(role, p.id);
                    return (
                      <td key={role} className="p-3 text-center">
                        <button
                          onClick={() => toggle.mutate({ role_code: role, permission_id: p.id, currently_active: active })}
                          className={["w-8 h-8 rounded-full text-white font-bold text-lg transition-colors mx-auto flex items-center justify-center", active ? "bg-green-500 hover:bg-green-600" : "bg-gray-200 hover:bg-gray-300 text-gray-500"].join(" ")}
                        >
                          {active ? "✓" : "×"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
