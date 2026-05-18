import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Warehouse as WarehouseIcon,
  ShoppingCart,
  ShoppingBag,
  Clock,
  RotateCcw,
  ArrowRightLeft,
  BarChart2,
  SlidersHorizontal,
  UserCog,
  History,
  Banknote,
  ScrollText,
  ShieldCheck,
  ArrowLeftRight,
  LogOut,
  Store,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Penjualan (POS)", icon: ShoppingCart },
  { to: "/purchases", label: "Pembelian", icon: ShoppingBag },
  { to: "/stock", label: "Stock Movement", icon: ArrowLeftRight },
  { to: "/products", label: "Master Barang", icon: Package },
  { to: "/suppliers", label: "Supplier", icon: Truck },
  { to: "/customers", label: "Customer", icon: Users },
  { to: "/warehouses", label: "Gudang", icon: WarehouseIcon },
  { to: "/shifts", label: "Shift Kasir", icon: Clock },
  { to: "/transfers", label: "Transfer Stok", icon: ArrowRightLeft },
  { to: "/returns", label: "Retur Pembelian", icon: RotateCcw },
  { to: "/reports", label: "Laporan", icon: BarChart2 },
  { to: "/adjustments", label: "Adjustment Stok", icon: SlidersHorizontal },
  { to: "/users", label: "Manajemen User", icon: UserCog },
  { to: "/price-history", label: "Riwayat Harga", icon: History },
  { to: "/debts", label: "Hutang Supplier", icon: Banknote },
  { to: "/activity-logs", label: "Activity Log", icon: ScrollText },
  { to: "/permissions", label: "Permission Matrix", icon: ShieldCheck },
] as const;

export function AppShell() {
  const { user, roles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 px-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Binowo</p>
            <p className="text-xs opacity-75">Kasir Grosir</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary"
                    : "hover:bg-sidebar-accent/50 border-l-4 border-transparent",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="text-xs opacity-75">
            <p className="font-medium truncate">{user?.email}</p>
            <p>{roles.join(", ") || "—"}</p>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center gap-3 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {NAV.find((n) => location.pathname === n.to || location.pathname.startsWith(n.to + "/"))?.label ?? "Binowo"}
          </h2>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
      <OfflineIndicator />
        </main>
      </div>
    </div>
  );
}