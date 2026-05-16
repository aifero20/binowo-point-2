import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export const Route = createFileRoute("/_authenticated/adjustments")({ component: AdjustmentsPage });

type AdjLine = { product_id: string; product_name: string; unit_name: string; qty_system: number; qty_actual: number };
type Adjustment = { id: string; adjustment_number: string; adjustment_date: string; warehouses: { warehouse_name: string } | null };

function AdjustmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<AdjLine[]>([]);
  const [searchProduct, setSearchProduct] = useState("");

  const { data: adjustments = [] } = useQuery({
    queryKey: ["adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_adjustments").select("id, adjustment_number, adjustment_date, warehouses(warehouse_name)").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as Adjustment[];
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
    setLines((prev) => prev.find((l) => l.product_id === p.id) ? prev : [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty_system: 0, qty_actual: 0 }]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error("Pilih gudang");
      if (lines.length === 0) throw new Error("Tambah item dulu");
      const adjustment_number = "ADJ" + Date.now();
      const { data: header, error: he } = await supabase.from("stock_adjustments").insert({ adjustment_number, warehouse_id: warehouseId, notes, created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const aid = (header as { id: string }).id;
      const details = lines.map((l) => ({ adjustment_id: aid, product_id: l.product_id, qty_system: l.qty_system, qty_actual: l.qty_actual, qty_difference: l.qty_actual - l.qty_system }));
      const { error: de } = await supabase.from("stock_adjustment_details").insert(details as never);
      if (de) throw de;
      const movements = lines.filter((l) => l.qty_actual !== l.qty_system).map((l) => {
        const diff = l.qty_actual - l.qty_system;
        return { product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "adjustment", reference_number: adjustment_number, qty_in: diff > 0 ? diff : 0, qty_out: diff < 0 ? Math.abs(diff) : 0, created_by: user!.id };
      });
      if (movements.length > 0) await supabase.from("stock_movements").insert(movements as never);
    },
    onSuccess: () => { toast.success("Adjustment disimpan"); qc.invalidateQueries(); setOpen(false); setLines([]); setWarehouseId(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Adjustment Stok</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Adjustment Stok</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Gudang *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alasan adjustment..." /></div>
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
            {lines.length > 0 && (
              <div className="border rounded divide-y mt-2">
                <div className="grid grid-cols-[1fr_100px_100px_80px_40px] gap-2 p-2 text-xs font-medium text-muted-foreground">
                  <span>Barang</span><span className="text-center">Stok Sistem</span><span className="text-center">Stok Aktual</span><span className="text-center">Selisih</span><span />
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="p-2 grid grid-cols-[1fr_100px_100px_80px_40px] gap-2 items-center text-sm">
                    <span className="truncate font-medium">{l.product_name}</span>
                    <Input type="number" value={l.qty_system} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty_system: Number(e.target.value) } : x))} className="h-8 text-center" />
                    <Input type="number" value={l.qty_actual} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty_actual: Number(e.target.value) } : x))} className="h-8 text-center" />
                    <span className={["text-center font-bold text-sm", (l.qty_actual - l.qty_system) > 0 ? "text-green-600" : (l.qty_actual - l.qty_system) < 0 ? "text-red-500" : ""].join(" ")}>
                      {l.qty_actual - l.qty_system > 0 ? "+" : ""}{l.qty_actual - l.qty_system}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan Adjustment"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>No. Adjustment</TableHead><TableHead>Tanggal</TableHead><TableHead>Gudang</TableHead></TableRow></TableHeader>
          <TableBody>
            {adjustments.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada adjustment.</TableCell></TableRow>}
            {adjustments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.adjustment_number}</TableCell>
                <TableCell className="text-xs">{new Date(a.adjustment_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>{a.warehouses?.warehouse_name ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
