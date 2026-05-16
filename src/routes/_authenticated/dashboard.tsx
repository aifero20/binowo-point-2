import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShoppingCart, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { formatRp } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const today = new Date().toISOString().split("T")[0];

  const { data: todaySales = 0 } = useQuery({
    queryKey: ["dash-today-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total").gte("transaction_date", today).is("deleted_at", null).neq("transaction_status", "VOID");
      return (data ?? []).reduce((s: number, r: { grand_total: number }) => s + Number(r.grand_total), 0);
    },
  });

  const { data: todayCount = 0 } = useQuery({
    queryKey: ["dash-today-count"],
    queryFn: async () => {
      const { count } = await supabase.from("sales_headers").select("*", { count: "exact", head: true }).gte("transaction_date", today).is("deleted_at", null).neq("transaction_status", "VOID");
      return count ?? 0;
    },
  });

  const { data: totalProducts = 0 } = useQuery({
    queryKey: ["dash-total-products"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ["dash-low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, product_code, product_name, minimum_stock, default_unit").is("deleted_at", null).eq("is_active", true).gt("minimum_stock", 0).limit(20);
      if (!data || data.length === 0) return [];
      const ids = data.map((p: { id: string }) => p.id);
      const { data: movements } = await supabase.from("stock_movements").select("product_id, qty_in, qty_out");
      const stockMap: Record<string, number> = {};
      for (const m of (movements ?? []) as { product_id: string; qty_in: number; qty_out: number }[]) {
        if (!stockMap[m.product_id]) stockMap[m.product_id] = 0;
        stockMap[m.product_id] += Number(m.qty_in) - Number(m.qty_out);
      }
      return data.filter((p: { id: string; minimum_stock: number }) => (stockMap[p.id] ?? 0) <= p.minimum_stock).map((p: { id: string; product_code: string; product_name: string; minimum_stock: number; default_unit: string }) => ({ ...p, current_stock: stockMap[p.id] ?? 0 }));
    },
  });

  const { data: weeklyChart = [] } = useQuery({
    queryKey: ["dash-weekly"],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const { data } = await supabase.from("sales_headers").select("grand_total, transaction_date").gte("transaction_date", from.toISOString()).is("deleted_at", null).neq("transaction_status", "VOID");
      const map: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        map[d.toISOString().split("T")[0]] = 0;
      }
      for (const r of (data ?? []) as { grand_total: number; transaction_date: string }[]) {
        const day = r.transaction_date.split("T")[0];
        if (map[day] !== undefined) map[day] += Number(r.grand_total);
      }
      return Object.entries(map).map(([date, total]) => ({ date: date.slice(5), total }));
    },
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["dash-recent-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("sales_number, grand_total, payment_method, transaction_status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Penjualan Hari Ini</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatRp(todaySales)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Transaksi Hari Ini</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{todayCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Total Produk Aktif</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalProducts}</p></CardContent>
        </Card>
        <Card className={lowStockProducts.length > 0 ? "border-orange-400" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Stok Menipis</CardTitle>
            <AlertTriangle className={["h-4 w-4", lowStockProducts.length > 0 ? "text-orange-500" : "text-muted-foreground"].join(" ")} />
          </CardHeader>
          <CardContent><p className={["text-2xl font-bold", lowStockProducts.length > 0 ? "text-orange-500" : ""].join(" ")}>{lowStockProducts.length} item</p></CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Penjualan 7 Hari Terakhir</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => formatRp(v)} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Transaksi Terakhir</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Total</TableHead><TableHead>Metode</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {recentSales.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Belum ada transaksi.</TableCell></TableRow>}
                {recentSales.map((s: { sales_number: string; grand_total: number; payment_method: string; transaction_status: string }) => (
                  <TableRow key={s.sales_number}>
                    <TableCell className="font-mono text-xs">{s.sales_number}</TableCell>
                    <TableCell className="font-medium text-sm">{formatRp(s.grand_total)}</TableCell>
                    <TableCell className="text-xs">{s.payment_method}</TableCell>
                    <TableCell><Badge variant={s.transaction_status === "VOID" ? "destructive" : "default"} className="text-xs">{s.transaction_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-orange-400">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />Alert: Stok Menipis ({lowStockProducts.length} item)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Barang</TableHead><TableHead className="text-right">Stok Saat Ini</TableHead><TableHead className="text-right">Minimum Stok</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {lowStockProducts.map((p: { id: string; product_code: string; product_name: string; current_stock: number; minimum_stock: number; default_unit: string }) => (
                  <TableRow key={p.id} className="bg-orange-50/50">
                    <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">{p.current_stock} {p.default_unit}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.minimum_stock} {p.default_unit}</TableCell>
                    <TableCell><Badge variant="outline" className="border-orange-400 text-orange-600 text-xs">{p.current_stock <= 0 ? "HABIS" : "MENIPIS"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
