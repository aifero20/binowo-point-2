import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/transfers")({ component: TransfersPage });

type TransferLine = { product_id: string; product_name: string; unit_name: string; qty: number };
type Transfer = { id: string; transfer_number: string; transfer_date: string; status: string; from_warehouse: { warehouse_name: string } | null; to_warehouse: { warehouse_name: string } | null };

function TransfersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [searchProduct, setSearchProduct] = useState("");

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_transfers").select("id, transfer_number, transfer_date, status, from_warehouse:from_warehouse_id(warehouse_name), to_warehouse:to_warehouse_id(warehouse_name)").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as Transfer[];
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", searchProduct],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_name, default_unit").is("deleted_at", null).limit(20);
      if (searchProduct) q = q.ilike("product_name", `%${searchProduct}%`);
      const { data } = await q; return data ?? [];
    },
  });

  function addLine(p: typeof products[0]) {
    setLines((prev) => prev.find((l) => l.product_id === p.id) ? prev : [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty: 1 }]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!fromWarehouse || !toWarehouse) throw new Error("Pilih gudang asal dan tujuan");
      if (fromWarehouse === toWarehouse) throw new Error("Gudang asal dan tujuan tidak boleh sama");
      if (lines.length === 0) throw new Error("Tambah item dulu");
      const transfer_number = "TRF" + Date.now();
      const { data: header, error: he } = await supabase.from("stock_transfers").insert({ transfer_number, from_warehouse_id: fromWarehouse, to_warehouse_id: toWarehouse, notes, status: "SELESAI", created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const tid = (header as { id: string }).id;
      const details = lines.map((l) => ({ transfer_id: tid, product_id: l.product_id, qty: l.qty, unit_name: l.unit_name }));
      const { error: de } = await supabase.from("stock_transfer_details").insert(details as never);
      if (de) throw de;
      const outMovements = lines.map((l) => ({ product_id: l.product_id, warehouse_id: fromWarehouse, transaction_type: "transfer_out", reference_number: transfer_number, qty_out: l.qty, created_by: user!.id }));
      const inMovements = lines.map((l) => ({ product_id: l.product_id, warehouse_id: toWarehouse, transaction_type: "transfer_in", reference_number: transfer_number, qty_in: l.qty, created_by: user!.id }));
      await supabase.from("stock_movements").insert([...outMovements, ...inMovements] as never);
    },
    onSuccess: () => { toast.success("Transfer stok berhasil"); qc.invalidateQueries(); setOpen(false); setLines([]); setFromWarehouse(""); setToWarehouse(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Transfer Stok</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Transfer Stok Antar Gudang</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Gudang Asal *</Label>
                  <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang asal..." /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Gudang Tujuan *</Label>
                  <Select value={toWarehouse} onValueChange={setToWarehouse}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang tujuan..." /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Cari Barang</Label>
                <Input autoFocus placeholder="Cari nama barang..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                <div className="border rounded max-h-48 overflow-y-auto divide-y">
                  {products.map((p) => (
                    <div key={p.id} className="p-2 text-sm hover:bg-accent cursor-pointer" onClick={() => addLine(p)}>{p.product_name}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border rounded divide-y mt-2">
              {lines.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Belum ada item</p>}
              {lines.map((l, i) => (
                <div key={i} className="p-2 grid grid-cols-[1fr_80px_40px] gap-2 items-center text-sm">
                  <span className="truncate font-medium">{l.product_name}</span>
                  <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8" />
                  <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <DialogFooter><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan Transfer"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>No. Transfer</TableHead><TableHead>Tanggal</TableHead><TableHead>Dari</TableHead><TableHead>Ke</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {transfers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada transfer.</TableCell></TableRow>}
            {transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.transfer_number}</TableCell>
                <TableCell className="text-xs">{new Date(t.transfer_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>{t.from_warehouse?.warehouse_name ?? "-"}</TableCell>
                <TableCell>{t.to_warehouse?.warehouse_name ?? "-"}</TableCell>
                <TableCell><span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{t.status}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
