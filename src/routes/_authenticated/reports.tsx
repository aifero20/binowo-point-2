import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatRp } from "@/lib/format";
import { toast } from "sonner";
import { supabase as sb } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({ beforeLoad: () => { throw redirect({ to: "/dashboard" }); }, component: ReportsPage });

function ReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const [syncing, setSyncing] = useState(false);

  async function syncToSheets() {
    setSyncing(true);
    try {
      const { data: sales } = await sb.from("sales_headers").select("sales_number, transaction_date, grand_total, payment_method, transaction_status, cashier_id").gte("transaction_date", dateFrom).lte("transaction_date", dateTo + "T23:59:59").is("deleted_at", null);
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("https://bapgptjffhufykvoxtnq.supabase.co/functions/v1/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: "all" }),
      });
      const result = await res.json();
      if (result.success) toast.success("Berhasil sync ke Google Sheets!");
      else toast.error("Sync gagal: " + JSON.stringify(result));
    } catch (e) {
      toast.error("Sync error: " + String(e));
    } finally {
      setSyncing(false);
    }
  }

  const { data: summary } = useQuery({
    queryKey: ["report-summary", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total, transaction_date").gte("transaction_date", dateFrom).lte("transaction_date", dateTo + "T23:59:59").is("deleted_at", null);
      const total = (data ?? []).reduce((s: number, r: { grand_total: number }) => s + Number(r.grand_total), 0);
      const count = (data ?? []).length;
      return { total, count, avg: count > 0 ? total / count : 0 };
    },
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["report-top-products", dateFrom, dateTo],
    queryFn: async () => {
      const { data: sales } = await supabase.from("sales_headers").select("id, transaction_date").gte("transaction_date", dateFrom).lte("transaction_date", dateTo + "T23:59:59").is("deleted_at", null);
      if (!sales || sales.length === 0) return [];
      const ids = sales.map((s: { id: string }) => s.id);
      const { data: details } = await supabase.from("sales_details").select("product_id, qty, total, products(product_name)").in("sales_id", ids);
      const map: Record<string, { name: string; qty: number; total: number }> = {};
      for (const d of (details ?? []) as { product_id: string; qty: number; total: number; products: { product_name: string } | null }[]) {
        if (!map[d.product_id]) map[d.product_id] = { name: d.products?.product_name ?? "-", qty: 0, total: 0 };
        map[d.product_id].qty += Number(d.qty);
        map[d.product_id].total += Number(d.total);
      }
      return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
    },
  });

  const { data: dailyChart = [] } = useQuery({
    queryKey: ["report-daily", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase.from("sales_headers").select("grand_total, transaction_date").gte("transaction_date", dateFrom).lte("transaction_date", dateTo + "T23:59:59").is("deleted_at", null);
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { grand_total: number; transaction_date: string }[]) {
        const day = r.transaction_date.split("T")[0];
        map[day] = (map[day] ?? 0) + Number(r.grand_total);
      }
      return Object.entries(map).sort().map(([date, total]) => ({ date: date.slice(5), total }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <Button variant="outline" onClick={syncToSheets} disabled={syncing} className="gap-2">
          {syncing ? "Syncing..." : "â˜ Sync ke Google Sheets"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Penjualan</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatRp(summary?.total ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Jumlah Transaksi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary?.count ?? 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Rata-rata Transaksi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatRp(summary?.avg ?? 0)}</p></CardContent></Card>
      </div>

      {dailyChart.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Grafik Penjualan Harian</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => formatRp(v)} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle className="text-base">Top 10 Barang Terlaris</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nama Barang</TableHead><TableHead className="text-right">Qty Terjual</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {topProducts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Tidak ada data.</TableCell></TableRow>}
              {topProducts.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.qty}</TableCell>
                  <TableCell className="text-right font-medium">{formatRp(p.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
