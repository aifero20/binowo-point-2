import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingCart, Package, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { formatRp } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const today = new Date().toISOString().split("T")[0];
  const [showFilter, setShowFilter] = useState(false);
  const [filterFrom, setFilterFrom] = useState(today);
  const [filterTo, setFilterTo] = useState(today);
  const [chartMode, setChartMode] = useState<"daily" | "monthly">("daily");

  // --- QUERIES ---
  const { data: todaySales = 0 } = useQuery({
    queryKey: ["dash-today-sales", filterFrom, filterTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total")
        .gte("transaction_date", filterFrom).lte("transaction_date", filterTo + "T23:59:59")
        .neq("transaction_status", "VOID");
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.grand_total), 0);
    },
  });

  const { data: todayCount = 0 } = useQuery({
    queryKey: ["dash-today-count", filterFrom, filterTo],
    queryFn: async () => {
      const { count } = await supabase.from("sales_headers").select("*", { count: "exact", head: true })
        .gte("transaction_date", filterFrom).lte("transaction_date", filterTo + "T23:59:59")
        .neq("transaction_status", "VOID");
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
      const { data } = await supabase.from("products").select("id, product_code, product_name, minimum_stock, default_unit").is("deleted_at", null).eq("is_active", true).gt("minimum_stock", 0).limit(50);
      if (!data || data.length === 0) return [];
      const { data: movements } = await supabase.from("stock_movements").select("product_id, qty_in, qty_out");
      const stockMap: Record<string, number> = {};
      for (const m of (movements ?? []) as any[]) {
        if (!stockMap[m.product_id]) stockMap[m.product_id] = 0;
        stockMap[m.product_id] += Number(m.qty_in) - Number(m.qty_out);
      }
      return data.filter((p: any) => (stockMap[p.id] ?? 0) <= p.minimum_stock)
        .map((p: any) => ({ ...p, current_stock: stockMap[p.id] ?? 0 }));
    },
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["dash-chart", filterFrom, filterTo, chartMode],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total, transaction_date")
        .gte("transaction_date", filterFrom).lte("transaction_date", filterTo + "T23:59:59")
        .neq("transaction_status", "VOID");
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) {
        const key = chartMode === "monthly"
          ? r.transaction_date.substring(0, 7)
          : r.transaction_date.split("T")[0];
        map[key] = (map[key] ?? 0) + Number(r.grand_total);
      }
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date: chartMode === "monthly" ? date : date.slice(5), total }));
    },
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["dash-top-products", filterFrom, filterTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_details").select("qty, product:product_id(product_name), sales:sales_id(transaction_date, transaction_status)")
        .limit(2000);
      const map: Record<string, { name: string; qty: number; total: number }> = {};
      for (const d of (data ?? []) as any[]) {
        if (d.sales?.transaction_status === "VOID") continue;
        const tgl = (d.sales?.transaction_date ?? "").split("T")[0];
        if (tgl < filterFrom || tgl > filterTo) continue;
        const name = d.product?.product_name ?? "-";
        if (!map[name]) map[name] = { name, qty: 0, total: 0 };
        map[name].qty += Number(d.qty);
      }
      return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
    },
  });

  const isFiltered = filterFrom !== today || filterTo !== today;

  function resetFilter() { setFilterFrom(today); setFilterTo(today); }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {isFiltered ? `Filter: ${filterFrom} s/d ${filterTo}` : "Menampilkan data hari ini"}
        </p>
        <Button variant={isFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowFilter(v => !v)}>
          <SlidersHorizontal className="h-4 w-4" />Filter{isFiltered ? " (aktif)" : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant={chartMode === "daily" ? "default" : "outline"} onClick={() => setChartMode("daily")}>Per Hari</Button>
              <Button size="sm" variant={chartMode === "monthly" ? "default" : "outline"} onClick={() => setChartMode("monthly")}>Per Bulan</Button>
              {isFiltered && <Button variant="ghost" size="sm" className="text-muted-foreground ml-auto" onClick={resetFilter}>Reset Filter</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Total Penjualan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatRp(todaySales)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Jumlah Transaksi</CardTitle>
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

      {/* Chart Penjualan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Grafik Penjualan {chartMode === "daily" ? "Per Hari" : "Per Bulan"}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={chartMode === "daily" ? "default" : "outline"} onClick={() => setChartMode("daily")}>Per Hari</Button>
            <Button size="sm" variant={chartMode === "monthly" ? "default" : "outline"} onClick={() => setChartMode("monthly")}>Per Bulan</Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => formatRp(v)} />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Produk Terlaris */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Produk Terlaris</CardTitle></CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada data penjualan.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{p.qty} pcs</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stok Menipis */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-400">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />Alert Stok Menipis ({lowStockProducts.length} item)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Barang</TableHead><TableHead className="text-right">Stok Saat Ini</TableHead><TableHead className="text-right">Min. Stok</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {lowStockProducts.map((p: any) => (
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