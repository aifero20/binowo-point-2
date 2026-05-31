import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerSheetsSync } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/debts")({ component: DebtsPage });

type Debt = { id: string; debt_date: string; due_date: string | null; amount: number; paid_amount: number; remaining: number; status: string; suppliers: { supplier_name: string } | null; purchase_headers: { purchase_number: string } | null };

function DebtsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payDialog, setPayDialog] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("TUNAI");
  const [payNotes, setPayNotes] = useState("");

  const { data: debts = [] } = useQuery({
    queryKey: ["supplier-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_debts").select("id, purchase_id, debt_date, due_date, amount, paid_amount, remaining, status, suppliers(supplier_name), purchase_headers(purchase_number)").order("debt_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Debt[];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["debt-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_debts").select("remaining, status");
      const total = (data ?? []).reduce((s: number, d: { remaining: number }) => s + Number(d.remaining), 0);
      const overdue = (data ?? []).filter((d: { status: string }) => d.status === "JATUH_TEMPO").length;
      return { total, overdue };
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!payDialog) return;
      const amount = Number(payAmount);
      if (amount <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0");
      if (amount > payDialog.remaining) throw new Error("Pembayaran melebihi sisa hutang");
      const newPaid = Number(payDialog.paid_amount) + amount;
      const newRemaining = Number(payDialog.amount) - newPaid;
      const newStatus = newRemaining <= 0 ? "LUNAS" : "BELUM_LUNAS";
      const { error: pe } = await supabase.from("supplier_debt_payments").insert({ debt_id: payDialog.id, amount, payment_method: payMethod, notes: payNotes, created_by: user!.id } as never);
      if (pe) throw pe;
      const { error: de } = await supabase.from("supplier_debts").update({ paid_amount: newPaid, remaining: newRemaining, status: newStatus } as never).eq("id", payDialog.id);
      if (de) throw de;
      if (newStatus === "LUNAS") {
        const purchaseId = (payDialog as any).purchase_id;
        if (purchaseId) await supabase.from("purchase_headers").update({ payment_status: "LUNAS" } as never).eq("id", purchaseId);
      }
    },
    onSuccess: () => { toast.success("Pembayaran berhasil"); qc.invalidateQueries(); setPayDialog(null); setPayAmount(""); setPayNotes(""); triggerSheetsSync("purchases"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = { LUNAS: "default", BELUM_LUNAS: "secondary", JATUH_TEMPO: "destructive" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hutang Tersisa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-500">{formatRp(summary?.total ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Jatuh Tempo</CardTitle></CardHeader>
          <CardContent><p className={["text-2xl font-bold", (summary?.overdue ?? 0) > 0 ? "text-destructive" : ""].join(" ")}>{summary?.overdue ?? 0} item</p></CardContent>
        </Card>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>No. PO</TableHead><TableHead>Tgl Hutang</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Terbayar</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {debts.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Belum ada hutang.</TableCell></TableRow>}
            {debts.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.suppliers?.supplier_name ?? "-"}</TableCell>
                <TableCell className="font-mono text-xs">{d.purchase_headers?.purchase_number ?? "-"}</TableCell>
                <TableCell className="text-xs">{new Date(d.debt_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell className="text-xs">{d.due_date ? new Date(d.due_date).toLocaleDateString("id-ID") : "-"}</TableCell>
                <TableCell className="text-right">{formatRp(d.amount)}</TableCell>
                <TableCell className="text-right text-green-600">{formatRp(d.paid_amount)}</TableCell>
                <TableCell className="text-right font-bold text-red-500">{formatRp(d.remaining)}</TableCell>
                <TableCell><Badge variant={statusColor[d.status] ?? "secondary"}>{d.status.replace("_", " ")}</Badge></TableCell>
                <TableCell>
                  {d.status !== "LUNAS" && (
                    <Button size="sm" className="gap-1" onClick={() => { setPayDialog(d); setPayAmount(String(d.remaining)); }}>
                      <CreditCard className="h-3 w-3" />Bayar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) setPayDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bayar Hutang â€” {payDialog?.suppliers?.supplier_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Sisa Hutang</span><span className="font-bold text-red-500">{formatRp(payDialog?.remaining ?? 0)}</span></div>
            <div className="space-y-1.5"><Label>Jumlah Bayar</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus /></div>
            <div className="space-y-1.5"><Label>Metode</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TUNAI">Tunai</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="CEK">Cek/Giro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opsional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Batal</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>{pay.isPending ? "Memproses..." : "Simpan Pembayaran"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
