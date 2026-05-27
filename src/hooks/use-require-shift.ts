import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function useRequireShift() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const role = (roles[0] ?? "").toLowerCase();
  const needsShift = role === "kasir" || role === "supervisor";

  const { data: hasOpenShift, isLoading } = useQuery({
    queryKey: ["active-shift-guard"],
    enabled: needsShift,
    queryFn: async () => {
      const { data } = await supabase
        .from("cashier_shifts")
        .select("id")
        .eq("shift_status", "OPEN")
        .limit(1)
        .single();
      return !!data;
    },
    retry: false,
  });

  useEffect(() => {
    if (!needsShift || isLoading) return;
    if (!hasOpenShift) {
      toast.warning("Buka shift terlebih dahulu sebelum mengakses halaman ini.");
      navigate({ to: "/shifts" });
    }
  }, [needsShift, isLoading, hasOpenShift]);

  return { needsShift, isLoading, hasOpenShift };
}
