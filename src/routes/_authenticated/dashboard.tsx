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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingCart, Package, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function getDateRange(preset: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "today") return { from: fmt(today), to: fmt(today) };
  if (preset === "7d") { const f = new Date(today); f.setDate(f.getDate() - 6); return { from: fmt(f), to: fmt(today) }; }
  if (preset === "30d") { const f = new Date(today); f.setDate(f.getDate() - 29); return { from: fmt(f), to: fmt(today) }; }
  if (preset === "90d") { const f = new Date(today); f.setDate(f.getDate() - 89); return { from: fmt(f), to: fmt(today) }; }
  if (preset === "thismonth") { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(f), to: fmt(today) }; }
  if (preset === "lastmonth") {
    const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const t = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: fmt(f), to: fmt(t) };
  }
  return { from: fmt(today), to: fmt(today) };
}

const PRESETS = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "thismonth", label: "Bulan Ini" },
  { key: "lastmonth", label: "Bulan Lalu" },
  { key: "30d", label: "30 Hari" },
  { key: "90d", label: "90 Hari" },
];

function DashboardPage() {
  const today = new Date().toISOString().split("T")[0];
  const [syncing, setSyncing] = useState(false);
  async function syncToSheets() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-sheets", { body: { type: "all" } });
      if (error) toast.error("Sync gagal: " + error.message);
      else toast.success("Berhasil sync ke Google Sheets!");
    } catch (e) {
      toast.error("Sync error: " + String(e));
    } finally {
      setSyncing(false);
    }
  }
  const [activePreset, setActivePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from: filterFrom, to: filterTo } = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return getDateRange(activePreset);
  }, [activePreset, customFrom, customTo]);

  const chartMode = useMemo(() => {
    const diffDays = (new Date(filterTo).getTime() - new Date(filterFrom).getTime()) / 86400000;
    return diffDays > 31 ? "monthly" : "daily";
  }, [filterFrom, filterTo]);

  function handlePreset(key: string) {
    setActivePreset(key);
    setCustomFrom("");
    setCustomTo("");
  }

  function handleCustomDate(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    setActivePreset("");
  }

  // --- QUERIES ---
  const { data: todaySales = 0 } = useQuery({
    queryKey: ["dash-sales", filterFrom, filterTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total")
        .gte("transaction_date", filterFrom).lte("transaction_date", filterTo + "T23:59:59")
        .neq("transaction_status", "VOID");
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.grand_total), 0);
    },
  });

  const { data: todayCount = 0 } = useQuery({
    queryKey: ["dash-count", filterFrom, filterTo],
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
        .map((p: any) => ({ ...p, current_stock: stockMap[p.id] ?? 0 }))
        .sort((a: any, b: any) => a.current_stock - b.current_stock);
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
        const key = chartMode === "monthly" ? r.transaction_date.substring(0, 7) : r.transaction_date.split("T")[0];
        map[key] = (map[key] ?? 0) + Number(r.grand_total);
      }
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date: chartMode === "monthly" ? date : date.slice(5), total }));
    },
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["dash-top-products", filterFrom, filterTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_details")
        .select("qty, product:product_id(product_name), sales:sales_id(transaction_date, transaction_status)")
        .limit(3000);
      const map: Record<string, { name: string; qty: number }> = {};
      for (const d of (data ?? []) as any[]) {
        if (d.sales?.transaction_status === "VOID") continue;
        const tgl = (d.sales?.transaction_date ?? "").split("T")[0];
        if (tgl < filterFrom || tgl > filterTo) continue;
        const name = d.product?.product_name ?? "-";
        if (!map[name]) map[name] = { name, qty: 0 };
        map[name].qty += Number(d.qty);
      }
      return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Data penjualan & operasional</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={syncToSheets} disabled={syncing}>
          <RefreshCw className={["h-4 w-4", syncing ? "animate-spin" : ""].join(" ")} />
          {syncing ? "Syncing..." : "Sync Google Sheets"}
        </Button>
      </div>
      {/* Filter Preset */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button key={p.key} size="sm" variant={activePreset === p.key ? "default" : "outline"} onClick={() => handlePreset(p.key)}>{p.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Custom: Dari Tanggal</Label>
              <Input type="date" value={customFrom} onChange={e => handleCustomDate(e.target.value, customTo || filterTo)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Custom: Sampai Tanggal</Label>
              <Input type="date" value={customTo} onChange={e => handleCustomDate(customFrom || filterFrom, e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Menampilkan: <span className="font-medium text-foreground">{filterFrom} s/d {filterTo}</span>
            {chartMode === "monthly" ? " — grafik ditampilkan per bulan" : " — grafik ditampilkan per hari"}
          </p>
        </CardContent>
      </Card>

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

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Grafik Penjualan {chartMode === "monthly" ? "Per Bulan" : "Per Hari"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data pada periode ini.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => formatRp(v)} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Produk */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Produk Terlaris</CardTitle></CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data pada periode ini.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0 text-xs">{p.qty} pcs</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.round((p.qty / topProducts[0].qty) * 100)}%` }} />
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
