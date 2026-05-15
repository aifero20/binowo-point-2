import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesPOS,
});

type CartLine = {
  product_id: string;
  product_name: string;
  unit_name: string;
  qty: number;
  selling_price: number;
};

function SalesPOS() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState(0);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_code, product_name, default_unit, current_retail_price").is("deleted_at", null).limit(20);
      if (search) q = q.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true);
      return data ?? [];
    },
  });

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.selling_price, 0), [cart]);
  const change = paymentAmount - subtotal;

  function addToCart(p: { id: string; product_name: string; default_unit: string; current_retail_price: number }) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      if (existing) return prev.map((l) => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty: 1, selling_price: Number(p.current_retail_price) }];
    });
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (!warehouseId) throw new Error("Pilih gudang");
      if (paymentAmount < subtotal) throw new Error("Pembayaran kurang");
      const sales_number = "SO" + Date.now();
      const { data: header, error: he } = await supabase.from("sales_headers").insert({
        sales_number,
        cashier_id: user!.id,
        subtotal,
        grand_total: subtotal,
        payment_amount: paymentAmount,
        change_amount: change,
        payment_method: "cash",
        transaction_status: "completed",
      } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      const details = cart.map((l) => ({
        sales_id: sid, product_id: l.product_id, warehouse_id: warehouseId,
        qty: l.qty, unit_name: l.unit_name, selling_price: l.selling_price, total: l.qty * l.selling_price,
      }));
      const { error: de } = await supabase.from("sales_details").insert(details as never);
      if (de) throw de;
      const movements = cart.map((l) => ({
        product_id: l.product_id, warehouse_id: warehouseId,
        transaction_type: "sale", reference_number: sales_number,
        qty_out: l.qty, created_by: user!.id,
      }));
      const { error: me } = await supabase.from("stock_movements").insert(movements as never);
      if (me) throw me;
      return sales_number;
    },
    onSuccess: (no) => {
      toast.success(`Transaksi ${no} berhasil`);
      setCart([]);
      setPaymentAmount(0);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Cari Barang</CardTitle>
          <Input autoFocus placeholder="Scan barcode / cari nama barang..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 text-base" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => addToCart(p)}>
                  <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="text-right">{formatRp(p.current_retail_price)}</TableCell>
                  <TableCell><Button size="sm" onClick={(e) => { e.stopPropagation(); addToCart(p); }}>+ Tambah</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="h-fit sticky top-20">
        <CardHeader><CardTitle>Keranjang</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Gudang</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {cart.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Keranjang kosong</p>}
            {cart.map((l, i) => (
              <div key={i} className="p-2 flex gap-2 items-center text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{l.product_name}</p>
                  <p className="text-xs text-muted-foreground">{formatRp(l.selling_price)} × {l.qty} {l.unit_name}</p>
                </div>
                <Input type="number" min={1} value={l.qty} onChange={(e) => setCart((c) => c.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="w-16 h-8" />
                <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-3">
            <span>Total</span><span className="text-primary">{formatRp(subtotal)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Bayar</Label>
            <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="h-12 text-lg" />
          </div>
          {paymentAmount > 0 && (
            <div className="flex justify-between text-sm"><span>Kembali</span><span className={change < 0 ? "text-destructive" : "text-foreground"}>{formatRp(change)}</span></div>
          )}
          <Button size="lg" className="w-full h-14 text-base" disabled={checkout.isPending || cart.length === 0} onClick={() => checkout.mutate()}>
            {checkout.isPending ? "Memproses..." : "Bayar (F12)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}