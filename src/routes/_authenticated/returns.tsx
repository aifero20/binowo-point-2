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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/returns")({ component: ReturnsPage });

type ReturnLine = { product_id: string; product_name: string; unit_name: string; qty: number; buy_price: number };
type ReturnDetail = { qty: number; unit_name: string; buy_price: number; products: { product_name: string } | null };
type ReturnHeader = { id: string; return_number: string; return_date: string; grand_total: number; suppliers: { supplier_name: string } | null; purchase_return_details: ReturnDetail[] };

function ReturnsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [searchProduct, setSearchProduct] = useState("");

  const { data: returns = [] } = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_returns").select("id, return_number, return_date, grand_total, suppliers(supplier_name), purchase_return_details(qty, unit_name, buy_price, products(product_name))").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as ReturnHeader[];
    },
  });

  const { data: salesReturns = [] } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_headers").select("id, sales_number, transaction_date:created_at, grand_total, customers(customer_name), sales_details(qty, unit_name, selling_price, products(product_name))").eq("transaction_status", "VOID").is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => { const { data } = await supabase.from("suppliers").select("id, supplier_name").is("deleted_at", null).order("supplier_name"); return data ?? []; },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", searchProduct],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_name, default_unit, current_buy_price").is("deleted_at", null).limit(20);
      if (searchProduct) q = q.ilike("product_name", `%${searchProduct}%`);
      const { data } = await q; return data ?? [];
    },
  });

  const grandTotal = lines.reduce((s, l) => s + l.qty * l.buy_price, 0);

  function addLine(p: typeof products[0]) {
    setLines((prev) => prev.find((l) => l.product_id === p.id) ? prev : [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty: 1, buy_price: Number(p.current_buy_price) }]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Pilih supplier");
      if (!warehouseId) throw new Error("Pilih gudang");
      if (lines.length === 0) throw new Error("Tambah item dulu");
      const return_number = "RTR" + Date.now();
      const { data: header, error: he } = await supabase.from("purchase_returns").insert({ return_number, supplier_id: supplierId, grand_total: grandTotal, notes, created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const rid = (header as { id: string }).id;
      const details = lines.map((l) => ({ return_id: rid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, buy_price: l.buy_price, total: l.qty * l.buy_price }));
      const { error: de } = await supabase.from("purchase_return_details").insert(details as never);
      if (de) throw de;
      const movements = lines.map((l) => ({ product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "return_out", reference_number: return_number, qty_out: l.qty, created_by: user!.id }));
      await supabase.from("stock_movements").insert(movements as never);
    },
    onSuccess: () => { toast.success("Retur berhasil disimpan"); qc.invalidateQueries(); setOpen(false); setLines([]); setSupplierId(""); setWarehouseId(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pembelian">
        <TabsList><TabsTrigger value="pembelian">Retur Pembelian</TabsTrigger><TabsTrigger value="penjualan">Retur Penjualan</TabsTrigger></TabsList>
        <TabsContent value="pembelian">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Buat Retur</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Retur Pembelian</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Supplier *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
                    <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Gudang *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alasan retur..." /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Cari Barang</Label>
                <Input autoFocus placeholder="Cari nama barang..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                <div className="border rounded max-h-48 overflow-y-auto divide-y">
                  {products.map((p) => (
                    <div key={p.id} className="p-2 flex justify-between text-sm hover:bg-accent cursor-pointer" onClick={() => addLine(p)}>
                      <span>{p.product_name}</span>
                      <span className="text-muted-foreground text-xs">{formatRp(p.current_buy_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border rounded divide-y mt-2">
              {lines.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Belum ada item</p>}
              {lines.map((l, i) => (
                <div key={i} className="p-2 grid grid-cols-[1fr_80px_120px_100px_40px] gap-2 items-center text-sm">
                  <span className="truncate font-medium">{l.product_name}</span>
                  <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8" />
                  <Input type="number" value={l.buy_price} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, buy_price: Number(e.target.value) } : x))} className="h-8" />
                  <span className="text-right text-muted-foreground">{formatRp(l.qty * l.buy_price)}</span>
                  <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>Total Retur</span><span className="text-red-500">{formatRp(grandTotal)}</span>
            </div>
            <DialogFooter><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan Retur"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>No. Retur</TableHead><TableHead>Tanggal</TableHead><TableHead>Supplier</TableHead><TableHead>Ringkasan Produk</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {returns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada retur pembelian.</TableCell></TableRow>}
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                <TableCell className="text-xs">{new Date(r.return_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>{r.suppliers?.supplier_name ?? "-"}</TableCell>
                <TableCell className="text-xs max-w-[220px]">
                  {(r.purchase_return_details ?? []).slice(0, 3).map((d, i) => (
                    <div key={i} className="truncate">{d.products?.product_name} <span className="text-muted-foreground">×{d.qty} {d.unit_name} @ {formatRp(d.buy_price)}</span></div>
                  ))}
                  {(r.purchase_return_details ?? []).length > 3 && <div className="text-muted-foreground">+{(r.purchase_return_details ?? []).length - 3} lainnya</div>}
                </TableCell>
                <TableCell className="text-right font-medium text-red-500">{formatRp(r.grand_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
        </TabsContent>
        <TabsContent value="penjualan">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Tanggal</TableHead><TableHead>Customer</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {salesReturns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada retur penjualan.</TableCell></TableRow>}
                {(salesReturns as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.sales_number}</TableCell>
                    <TableCell className="text-xs">{new Date(r.transaction_date).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>{r.customers?.customer_name ?? <span className="text-muted-foreground text-xs">Umum</span>}</TableCell>
                    <TableCell className="text-xs max-w-[220px]">
                      {(r.sales_details ?? []).slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="truncate">{d.products?.product_name} <span className="text-muted-foreground">×{d.qty} {d.unit_name}</span></div>
                      ))}
                      {(r.sales_details ?? []).length > 3 && <div className="text-muted-foreground">+{(r.sales_details ?? []).length - 3} lainnya</div>}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-500">{formatRp(r.grand_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
