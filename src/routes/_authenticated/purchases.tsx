import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/purchases")({ component: PurchasesPage });

type PurchaseLine = { product_id: string; product_name: string; unit_name: string; qty: number; buy_price: number; retail_price: number; wholesale_price: number };
type PurchaseHeader = { id: string; purchase_number: string; transaction_date: string; grand_total: number; suppliers: { supplier_name: string } | null };

function PurchasesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("LUNAS");
  const [searchProduct, setSearchProduct] = useState("");

  const { data: headers = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_headers").select("id, purchase_number, transaction_date, grand_total, suppliers(supplier_name)").is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as PurchaseHeader[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => { const { data } = await supabase.from("suppliers").select("id, supplier_name").is("deleted_at", null).order("supplier_name"); return data ?? []; },
  });

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const utama = warehouses.find((w) => w.warehouse_name.toLowerCase().includes("utama")) ?? warehouses[0];
      setWarehouseId(utama.id);
    }
  }, [warehouses]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", searchProduct],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_code, product_name, default_unit, current_buy_price, current_retail_price, current_wholesale_price").is("deleted_at", null).limit(20);
      if (searchProduct) q = q.or(`product_name.ilike.%${searchProduct}%,product_code.ilike.%${searchProduct}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const grandTotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.buy_price, 0), [lines]);

  function addLine(p: typeof products[0]) {
    setLines((prev) => {
      const ex = prev.find((l) => l.product_id === p.id);
      if (ex) return prev.map((l) => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty: 1, buy_price: Number(p.current_buy_price), retail_price: Number(p.current_retail_price), wholesale_price: Number(p.current_wholesale_price) }];
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Pilih supplier");
      if (!warehouseId) throw new Error("Pilih gudang");
      if (lines.length === 0) throw new Error("Tambah item dulu");
      const purchase_number = "PO" + Date.now();
      const { data: header, error: he } = await supabase.from("purchase_headers").insert({ purchase_number, invoice_number: invoiceNumber, supplier_id: supplierId, subtotal: grandTotal, grand_total: grandTotal, payment_status: paymentStatus, created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const pid = (header as { id: string }).id;
      const details = lines.map((l) => ({ purchase_id: pid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, buy_price: l.buy_price, retail_price: l.retail_price, wholesale_price: l.wholesale_price, total: l.qty * l.buy_price }));
      const { error: de } = await supabase.from("purchase_details").insert(details as never);
      if (de) throw de;
      const movements = lines.map((l) => ({ product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "purchase", reference_number: purchase_number, qty_in: l.qty, created_by: user!.id }));
      const { error: me } = await supabase.from("stock_movements").insert(movements as never);
      if (me) throw me;
      if (paymentStatus === "HUTANG") {
        await supabase.from("supplier_debts").insert({ supplier_id: supplierId, purchase_id: pid, amount: grandTotal, paid_amount: 0, remaining: grandTotal, due_date: dueDate || null, status: "BELUM_LUNAS" } as never);
      }
      for (const l of lines) {
        await supabase.from("products").update({ current_buy_price: l.buy_price, current_retail_price: l.retail_price, current_wholesale_price: l.wholesale_price } as never).eq("id", l.product_id);
      }
    },
    onSuccess: () => { toast.success("Pembelian disimpan"); qc.invalidateQueries(); setOpen(false); setLines([]); setSupplierId(""); setWarehouseId(""); setInvoiceNumber(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" /> Buat Pembelian</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Pembelian Baru</DialogTitle></DialogHeader>
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
                <div className="space-y-1.5"><Label>No. Invoice</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Opsional" /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Cari Barang</Label>
                <Input autoFocus placeholder="Cari nama / kode..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                <div className="border rounded max-h-48 overflow-y-auto divide-y">
                  {products.map((p) => (
                    <div key={p.id} className="p-2 flex justify-between items-center text-sm hover:bg-accent cursor-pointer" onClick={() => addLine(p)}>
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
                <div key={i} className="p-2 grid grid-cols-[1fr_80px_120px_120px_40px] gap-2 items-center text-sm">
                  <span className="truncate font-medium">{l.product_name}</span>
                  <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8" />
                  <Input type="number" value={l.buy_price} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, buy_price: Number(e.target.value) } : x))} className="h-8" placeholder="Harga beli" />
                  <span className="text-right text-muted-foreground">{formatRp(l.qty * l.buy_price)}</span>
                  <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center font-bold text-lg border-t pt-3">
              <span>Total</span><span className="text-primary">{formatRp(grandTotal)}</span>
            </div>
            <DialogFooter><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan Pembelian"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>No. PO</TableHead><TableHead>Tanggal</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {headers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada pembelian.</TableCell></TableRow>}
            {headers.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-mono text-xs">{h.purchase_number}</TableCell>
                <TableCell>{new Date(h.transaction_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>{h.suppliers?.supplier_name ?? "-"}</TableCell>
                <TableCell className="text-right font-medium">{formatRp(h.grand_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
