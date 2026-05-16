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
import { Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/shifts")({ component: ShiftsPage });

type Shift = { id: string; open_time: string; close_time: string | null; opening_cash: number; closing_cash: number; expected_cash: number; cash_difference: number; shift_status: string };

function ShiftsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cashier_shifts").select("*").order("open_time", { ascending: false }).limit(20);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const activeShift = shifts.find((s) => s.shift_status === "OPEN");

  const { data: todaySales = 0 } = useQuery({
    queryKey: ["today-sales"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("sales_headers").select("grand_total").gte("transaction_date", today).is("deleted_at", null);
      return (data ?? []).reduce((s: number, r: { grand_total: number }) => s + Number(r.grand_total), 0);
    },
  });

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
      const expected = Number(activeShift.opening_cash) + todaySales;
      const diff = closing - expected;
      const { error } = await supabase.from("cashier_shifts").update({ close_time: new Date().toISOString(), closing_cash: closing, expected_cash: expected, cash_difference: diff, shift_status: "CLOSED" } as never).eq("id", activeShift.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift ditutup"); qc.invalidateQueries({ queryKey: ["shifts"] }); setCloseShiftOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status Shift</CardTitle></CardHeader>
          <CardContent><Badge variant={activeShift ? "default" : "secondary"} className="text-base px-3 py-1">{activeShift ? "SHIFT AKTIF" : "TIDAK ADA SHIFT"}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Penjualan Hari Ini</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatRp(todaySales)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Kas Awal</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeShift ? formatRp(activeShift.opening_cash) : "-"}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {!activeShift && (
          <Button onClick={() => setOpenShiftOpen(true)} className="gap-2"><Clock className="h-4 w-4" />Buka Shift</Button>
        )}
        {activeShift && (
          <Button variant="destructive" onClick={() => setCloseShiftOpen(true)} className="gap-2"><DollarSign className="h-4 w-4" />Tutup Shift</Button>
        )}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Buka</TableHead><TableHead>Tutup</TableHead><TableHead className="text-right">Kas Awal</TableHead><TableHead className="text-right">Kas Akhir</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Selisih</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {shifts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada shift.</TableCell></TableRow>}
            {shifts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-xs">{new Date(s.open_time).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-xs">{s.close_time ? new Date(s.close_time).toLocaleString("id-ID") : "-"}</TableCell>
                <TableCell className="text-right">{formatRp(s.opening_cash)}</TableCell>
                <TableCell className="text-right">{s.closing_cash ? formatRp(s.closing_cash) : "-"}</TableCell>
                <TableCell className="text-right">{s.expected_cash ? formatRp(s.expected_cash) : "-"}</TableCell>
                <TableCell className={["text-right font-bold", s.cash_difference < 0 ? "text-red-500" : "text-green-600"].join(" ")}>{s.cash_difference ? formatRp(s.cash_difference) : "-"}</TableCell>
                <TableCell><Badge variant={s.shift_status === "OPEN" ? "default" : "secondary"}>{s.shift_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={openShiftOpen} onOpenChange={setOpenShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buka Shift Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Kas Awal (Rp)</Label>
            <Input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} autoFocus />
          </div>
          <DialogFooter><Button onClick={() => openShift.mutate()} disabled={openShift.isPending}>{openShift.isPending ? "Membuka..." : "Buka Shift"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tutup Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Penjualan Hari Ini</span><span className="font-bold text-green-600">{formatRp(todaySales)}</span></div>
            <div className="flex justify-between text-sm"><span>Kas Awal</span><span>{formatRp(activeShift?.opening_cash ?? 0)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t pt-2"><span>Expected Total</span><span>{formatRp((activeShift?.opening_cash ?? 0) + todaySales)}</span></div>
            <Label>Kas Akhir (Rp)</Label>
            <Input type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => closeShift.mutate()} disabled={closeShift.isPending}>{closeShift.isPending ? "Menutup..." : "Tutup Shift"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
