import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, ShoppingCart, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [products, suppliers, sales, lowStock] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("suppliers").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase
          .from("sales_headers")
          .select("grand_total")
          .gte("transaction_date", today.toISOString())
          .is("deleted_at", null),
        supabase.from("products").select("id, product_name, minimum_stock").is("deleted_at", null).gt("minimum_stock", 0).limit(5),
      ]);
      const todayTotal = (sales.data ?? []).reduce((s, r) => s + Number(r.grand_total), 0);
      return {
        products: products.count ?? 0,
        suppliers: suppliers.count ?? 0,
        salesToday: todayTotal,
        salesCount: sales.data?.length ?? 0,
        lowStock: lowStock.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Penjualan Hari Ini", value: formatRp(stats?.salesToday ?? 0), icon: ShoppingCart, sub: `${stats?.salesCount ?? 0} transaksi` },
    { label: "Total Barang", value: stats?.products ?? 0, icon: Package },
    { label: "Total Supplier", value: stats?.suppliers ?? 0, icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <Icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Barang dengan Minimum Stok
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.lowStock?.length ? (
            <ul className="divide-y">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="py-2 flex justify-between text-sm">
                  <span>{p.product_name}</span>
                  <span className="text-muted-foreground">Min: {p.minimum_stock}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}