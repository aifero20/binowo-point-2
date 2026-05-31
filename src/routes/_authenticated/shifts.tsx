import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, DollarSign, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/shifts")({ component: ShiftsPage });

type Shift = { id: string; open_time: string; close_time: string | null; opening_cash: number; closing_cash: number; expected_cash: number; cash_difference: number; shift_status: string; cashier_id: string | null; total_tunai: number; total_qris: number; total_transfer: number; total_pembelian_tunai: number; kasir_name?: string };

const PAGE_SIZE = 10;

function ShiftsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [showFilter, setShowFilter] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [page, setPage] = useState(1);

  const today = new Date().toISOString().split("T")[0];

  const { data: allShifts = [] } = useQuery({
    queryKey: ["shifts", filterFrom, filterTo],
    queryFn: async () => {
      let q = supabase.from("cashier_shifts").select("*").order("open_time", { ascending: false });
      if (filterFrom) q = q.gte("open_time", filterFrom + "T00:00:00");
      if (filterTo) q = q.lte("open_time", filterTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      const shifts = data as Shift[];
      const cashierIds = [...new Set(shifts.map((s) => s.cashier_id).filter(Boolean))];
      if (cashierIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, full_name").in("id", cashierIds);
        const userMap: Record<string, string> = {};
        (users ?? []).forEach((u: any) => { userMap[u.id] = u.full_name; });
        return shifts.map((s) => ({ ...s, kasir_name: s.cashier_id ? (userMap[s.cashier_id] ?? "-") : "-" }));
      }
      return shifts.map((s) => ({ ...s, kasir_name: "-" }));
    },
  });

  const totalPages = Math.max(1, Math.ceil(allShifts.length / PAGE_SIZE));
  const shifts = allShifts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeShift = allShifts.find((s) => s.shift_status === "OPEN");

  // Hitung transaksi selama shift aktif
  const { data: shiftStats } = useQuery({
    queryKey: ["shift-stats", activeShift?.id],
    enabled: !!activeShift,
    queryFn: async () => {
      const from = activeShift!.open_time;
      // Penjualan per metode
      const { data: sales } = await supabase.from("sales_headers")
        .select("grand_total, payment_method")
        .eq("transaction_status", "SELESAI")
        .gte("transaction_date", from)
        .is("deleted_at", null);
      const tunai = (sales ?? []).filter((s: any) => s.payment_method === "TUNAI").reduce((a: number, s: any) => a + Number(s.grand_total), 0);
      const qris = (sales ?? []).filter((s: any) => s.payment_method === "QRIS").reduce((a: number, s: any) => a + Number(s.grand_total), 0);
      const transfer = (sales ?? []).filter((s: any) => s.payment_method === "TRANSFER").reduce((a: number, s: any) => a + Number(s.grand_total), 0);
      // Retur penjualan â€” kas keluar (kembalikan uang ke customer)
      const { data: salesReturns } = await supabase.from("sales_headers")
        .select("grand_total")
        .eq("transaction_status", "VOID")
        .eq("payment_method", "RETUR")
        .gte("created_at", from)
        .is("deleted_at", null);
      const returTunai = (salesReturns ?? []).reduce((a: number, r: any) => a + Number(r.grand_total), 0);
      // Pembelian tunai (LUNAS)
      const { data: purchases } = await supabase.from("purchase_headers")
        .select("grand_total, payment_status")
        .eq("payment_status", "LUNAS")
        .gte("created_at", from)
        .is("deleted_at", null);
      const pembelianTunai = (purchases ?? []).reduce((a: number, p: any) => a + Number(p.grand_total), 0);
      return { tunai, qris, transfer, returTunai, pembelianTunai };
    },
  });

  const expectedKas = (activeShift?.opening_cash ?? 0) + (shiftStats?.tunai ?? 0) - (shiftStats?.returTunai ?? 0) - (shiftStats?.pembelianTunai ?? 0);

  const openShift = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cashier_shifts").insert({ cashier_id: user!.id, opening_cash: Number(openingCash), shift_status: "OPEN" } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift dibuka"); qc.invalidateQueries({ queryKey: ["shifts"] }); setOpenShiftOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeShift = useMutation({
    mutationFn: async () => {
      if (!activeShift) return;
      const closing = Number(closingCash);
      const diff = closing - expectedKas;
      const { error } = await supabase.from("cashier_shifts").update({
        close_time: new Date().toISOString(),
        closing_cash: closing,
        expected_cash: expectedKas,
        cash_difference: diff,
        shift_status: "CLOSED",
        total_tunai: shiftStats?.tunai ?? 0,
        total_qris: shiftStats?.qris ?? 0,
        total_transfer: shiftStats?.transfer ?? 0,
        total_pembelian_tunai: shiftStats?.pembelianTunai ?? 0,
        total_retur_tunai: shiftStats?.returTunai ?? 0,
      } as never).eq("id", activeShift.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift ditutup"); qc.invalidateQueries({ queryKey: ["shifts"] }); setCloseShiftOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetFilter() { setFilterFrom(""); setFilterTo(""); setPage(1); }
  const isFiltered = filterFrom || filterTo;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status Shift</CardTitle></CardHeader>
          <CardContent><Badge variant={activeShift ? "default" : "secondary"} className="text-base px-3 py-1">{activeShift ? "SHIFT AKTIF" : "TIDAK ADA SHIFT"}</Badge>{activeShift && <p className="text-sm text-muted-foreground mt-1">Dibuka oleh: <span className="font-medium text-foreground">{activeShift.kasir_name ?? "-"}</span></p>}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Penjualan Tunai Shift Ini</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatRp(shiftStats?.tunai ?? 0)}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Kas Awal</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeShift ? formatRp(activeShift.opening_cash) : "-"}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2">
          {!activeShift && <Button onClick={() => setOpenShiftOpen(true)} className="gap-2"><Clock className="h-4 w-4" />Buka Shift</Button>}
          {activeShift && activeShift.cashier_id === user?.id && <Button variant="destructive" onClick={() => setCloseShiftOpen(true)} className="gap-2"><DollarSign className="h-4 w-4" />Tutup Shift</Button>}{activeShift && activeShift.cashier_id !== user?.id && <p className="text-sm text-muted-foreground py-2">Shift dibuka oleh <span className="font-medium text-foreground">{activeShift.kasir_name}</span>. Hanya kasir tersebut yang dapat menutup shift.</p>}
        </div>
        <Button variant={isFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowFilter((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" />Filter{isFiltered ? " (aktif)" : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Dari Tanggal Buka</Label><Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Sampai Tanggal Buka</Label><Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} /></div>
            </div>
            {isFiltered && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={resetFilter}>Reset Filter</Button>}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Kasir</TableHead>
            <TableHead>Buka</TableHead>
            <TableHead>Tutup</TableHead>
            <TableHead className="text-right">Kas Awal</TableHead>
            <TableHead className="text-right">Tunai</TableHead>
            <TableHead className="text-right">QRIS</TableHead>
            <TableHead className="text-right">Transfer</TableHead>
            <TableHead className="text-right">Pembelian</TableHead>
            <TableHead className="text-right">Retur Jual</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Kas Aktual</TableHead>
            <TableHead className="text-right">Selisih</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {shifts.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Belum ada shift.</TableCell></TableRow>}
            {shifts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-sm">{s.kasir_name ?? "-"}</TableCell>
                <TableCell className="text-xs">{new Date(s.open_time).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-xs">{s.close_time ? new Date(s.close_time).toLocaleString("id-ID") : "-"}</TableCell>
                <TableCell className="text-right">{formatRp(s.opening_cash)}</TableCell>
                <TableCell className="text-right text-green-600">{s.total_tunai ? formatRp(s.total_tunai) : "-"}</TableCell>
                <TableCell className="text-right text-blue-600">{s.total_qris ? formatRp(s.total_qris) : "-"}</TableCell>
                <TableCell className="text-right text-purple-600">{s.total_transfer ? formatRp(s.total_transfer) : "-"}</TableCell>
                <TableCell className="text-right text-red-500">{s.total_pembelian_tunai ? formatRp(s.total_pembelian_tunai) : "-"}</TableCell>
                <TableCell className="text-right text-orange-500">{(s as any).total_retur_tunai ? formatRp((s as any).total_retur_tunai) : "-"}</TableCell>
                <TableCell className="text-right">{s.expected_cash ? formatRp(s.expected_cash) : "-"}</TableCell>
                <TableCell className="text-right">{s.closing_cash ? formatRp(s.closing_cash) : "-"}</TableCell>
                <TableCell className={["text-right font-bold", s.cash_difference < 0 ? "text-red-500" : s.cash_difference > 0 ? "text-green-600" : ""].join(" ")}>{s.cash_difference !== null && s.cash_difference !== undefined ? formatRp(s.cash_difference) : "-"}</TableCell>
                <TableCell><Badge variant={s.shift_status === "OPEN" ? "default" : "secondary"}>{s.shift_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>Halaman {page} dari {totalPages} ({allShifts.length} data)</span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={openShiftOpen} onOpenChange={setOpenShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buka Shift Baru</DialogTitle></DialogHeader>
          <div className="space-y-3"><Label>Kas Awal (Rp)</Label><Input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} autoFocus /></div>
          <DialogFooter><Button onClick={() => openShift.mutate()} disabled={openShift.isPending}>{openShift.isPending ? "Membuka..." : "Buka Shift"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tutup Shift</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Kas Awal</span><span>{formatRp(activeShift?.opening_cash ?? 0)}</span></div>
            <div className="flex justify-between text-green-600"><span>+ Penjualan Tunai</span><span>{formatRp(shiftStats?.tunai ?? 0)}</span></div>
            <div className="flex justify-between text-blue-600"><span>Penjualan QRIS</span><span>{formatRp(shiftStats?.qris ?? 0)}</span></div>
            <div className="flex justify-between text-purple-600"><span>Penjualan Transfer</span><span>{formatRp(shiftStats?.transfer ?? 0)}</span></div>
            <div className="flex justify-between text-red-500"><span>- Retur Tunai</span><span>{formatRp(shiftStats?.returTunai ?? 0)}</span></div>
            <div className="flex justify-between text-red-500"><span>- Pembelian Tunai</span><span>{formatRp(shiftStats?.pembelianTunai ?? 0)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Expected Kas</span><span>{formatRp(expectedKas)}</span></div>
            <div className="pt-2 space-y-1.5">
              <Label>Kas Aktual (Rp) — hitung fisik</Label>
              <Input type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
            </div>
            {closingCash && (
              <div className={["flex justify-between font-bold", Number(closingCash) - expectedKas < 0 ? "text-red-500" : "text-green-600"].join(" ")}>
                <span>Selisih</span><span>{formatRp(Number(closingCash) - expectedKas)}</span>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => closeShift.mutate()} disabled={closeShift.isPending}>{closeShift.isPending ? "Menutup..." : "Tutup Shift"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
