import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    let { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) {
        throw redirect({
          to: "/login",
          search: { redirect: location.href },
        });
      }
    }
  },
  component: AuthenticatedLayout,
});
function AuthenticatedLayout() {
  const { loading, user } = useAuth();
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    );
  }
  return <AppShell />;
}
