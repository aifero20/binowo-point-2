import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "supervisor" | "kasir";

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && s?.user) {
        void supabase.from("activity_logs").insert({ user_id: s.user.id, activity_type: "LOGIN", description: `Login: ${s.user.email}` } as never);
      }
      if (event === "SIGNED_OUT") {
        void supabase.from("activity_logs").insert({ activity_type: "LOGOUT", description: "User logout" } as never);
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer role fetch to avoid deadlock
        setTimeout(() => {
          void fetchRoles(s.user.id);
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchRoles(s.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from("users")
      .select("role_code, is_active")
      .eq("id", userId)
      .single();

    if (!data || data.is_active === false) {
      await supabase.auth.signOut();
      return;
    }

    const role = data.role_code?.toLowerCase() as AppRole;
    setRoles(role ? [role] : []);
  }

  const value: AuthState = {
    user,
    session,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}