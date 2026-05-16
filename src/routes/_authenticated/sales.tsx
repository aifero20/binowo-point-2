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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, ShoppingCart, PauseCircle, PlayCircle, XCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { isOnline, saveOfflineSale, syncPendingSales } from "@/lib/offline-sync";
import { db } from "@/lib/db";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/sales")({ component: SalesPOS });

type CartLine = { product_id: string; product_name: string; unit_name: string; qty: number; selling_price: number };

function SalesPOS() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("TUNAI");
  const [voidDialog, setVoidDialog] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(!isOnline());

  useEffect(() => {
    const onOnline = () => { setOfflineMode(false); syncPendingSales(); };
    const onOffline = () => setOfflineMode(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    syncPendingSales();
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);
  const [printData, setPrintData] = useState<{ no: string; items: CartLine[]; total: number; bayar: number; kembali: number } | null>(null);

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
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: heldTransactions = [] } = useQuery({
    queryKey: ["held-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_headers").select("id, sales_number, grand_total, created_at").eq("hold_status", true).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["recent-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_headers").select("id, sales_number, grand_total, transaction_status, payment_method, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
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
      if (paymentMethod === "TUNAI" && paymentAmount < subtotal) throw new Error("Pembayaran kurang");
      const sales_number = "SO" + Date.now();
      const { data: header, error: he } = await supabase.from("sales_headers").insert({ sales_number, cashier_id: user!.id, subtotal, grand_total: subtotal, payment_amount: paymentAmount, change_amount: change, payment_method: paymentMethod, transaction_status: "SELESAI", hold_status: false } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      await supabase.from("sales_details").insert(cart.map((l) => ({ sales_id: sid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, selling_price: l.selling_price, total: l.qty * l.selling_price })) as never);
      await supabase.from("stock_movements").insert(cart.map((l) => ({ product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "sale", reference_number: sales_number, qty_out: l.qty, created_by: user!.id })) as never);
      return { no: sales_number, items: [...cart], total: subtotal, bayar: paymentAmount, kembali: change };
    },
    onSuccess: (data) => {
      toast.success(`Transaksi ${data.no} berhasil`);
      setPrintData(data);
      setCart([]);
      setPaymentAmount(0);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const holdTransaction = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (!warehouseId) throw new Error("Pilih gudang");
      const sales_number = "HOLD" + Date.now();
      const { data: header, error: he } = await supabase.from("sales_headers").insert({ sales_number, cashier_id: user!.id, subtotal, grand_total: subtotal, payment_method: paymentMethod, transaction_status: "HOLD", hold_status: true } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      await supabase.from("sales_details").insert(cart.map((l) => ({ sales_id: sid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, selling_price: l.selling_price, total: l.qty * l.selling_price })) as never);
    },
    onSuccess: () => { toast.success("Transaksi di-hold"); setCart([]); setPaymentAmount(0); qc.invalidateQueries({ queryKey: ["held-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeHold = useMutation({
    mutationFn: async (id: string) => {
      const { data: details } = await supabase.from("sales_details").select("product_id, qty, unit_name, selling_price, products(product_name)").eq("sales_id", id);
      const { error } = await supabase.from("sales_headers").update({ hold_status: false, deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
      return (details ?? []).map((d: { product_id: string; qty: number; unit_name: string; selling_price: number; products: { product_name: string } | null }) => ({ product_id: d.product_id, product_name: d.products?.product_name ?? "-", unit_name: d.unit_name, qty: Number(d.qty), selling_price: Number(d.selling_price) }));
    },
    onSuccess: (items) => { setCart(items); toast.success("Transaksi dilanjutkan"); qc.invalidateQueries({ queryKey: ["held-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_headers").update({ deleted_at: new Date().toISOString(), transaction_status: "VOID" } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transaksi di-void"); setVoidDialog(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pos">
        <TabsList><TabsTrigger value="pos">POS Kasir</TabsTrigger><TabsTrigger value="held">Hold ({heldTransactions.length})</TabsTrigger><TabsTrigger value="history">Riwayat</TabsTrigger></TabsList>

        <TabsContent value="pos">
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
                    {products.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Ketik untuk cari barang...</TableCell></TableRow>}
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
              <CardHeader><CardTitle className="flex items-center justify-between">Keranjang{offlineMode && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-normal">● OFFLINE</span>}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Gudang</Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                      <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                      <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pembayaran</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TUNAI">Tunai</SelectItem>
                        <SelectItem value="TRANSFER">Transfer</SelectItem>
                        <SelectItem value="QRIS">QRIS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                  {cart.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Keranjang kosong</p>}
                  {cart.map((l, i) => (
                    <div key={i} className="p-2 flex gap-2 items-center text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{l.product_name}</p>
                        <p className="text-xs text-muted-foreground">{formatRp(l.selling_price)} × {l.qty}</p>
                      </div>
                      <Input type="number" min={1} value={l.qty} onChange={(e) => setCart((c) => c.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="w-16 h-8" />
                      <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total</span><span className="text-primary">{formatRp(subtotal)}</span>
                </div>
                {paymentMethod === "TUNAI" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Bayar</Label>
                      <Input type="number" value={paymentAmount || ""} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="h-12 text-lg" placeholder="0" />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[5000, 10000, 20000, 50000, 100000, 200000].map((v) => (
                        <Button key={v} variant="outline" size="sm" onClick={() => setPaymentAmount((p) => p + v)}>{formatRp(v)}</Button>
                      ))}
                    </div>
                    {paymentAmount > 0 && (
                      <div className="flex justify-between text-sm font-medium">
                        <span>Kembali</span>
                        <span className={change < 0 ? "text-destructive" : "text-green-600"}>{formatRp(change)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-1" disabled={holdTransaction.isPending || cart.length === 0} onClick={() => holdTransaction.mutate()}>
                    <PauseCircle className="h-4 w-4" />Hold
                  </Button>
                  <Button size="lg" disabled={checkout.isPending || cart.length === 0} onClick={() => checkout.mutate()}>
                    {checkout.isPending ? "Memproses..." : "Bayar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="held">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Waktu</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
              <TableBody>
                {heldTransactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Tidak ada transaksi hold.</TableCell></TableRow>}
                {heldTransactions.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.sales_number}</TableCell>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right font-medium">{formatRp(h.grand_total)}</TableCell>
                    <TableCell>
                      <Button size="sm" className="gap-1" onClick={() => resumeHold.mutate(h.id)} disabled={resumeHold.isPending}>
                        <PlayCircle className="h-4 w-4" />Lanjutkan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Waktu</TableHead><TableHead>Metode</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>
                {recentSales.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada transaksi.</TableCell></TableRow>}
                {recentSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sales_number}</TableCell>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-xs">{s.payment_method}</TableCell>
                    <TableCell className="text-right font-medium">{formatRp(s.grand_total)}</TableCell>
                    <TableCell><Badge variant={s.transaction_status === "VOID" ? "destructive" : s.transaction_status === "HOLD" ? "secondary" : "default"}>{s.transaction_status}</Badge></TableCell>
                    <TableCell>
                      {s.transaction_status === "SELESAI" && (
                        <Button size="icon" variant="ghost" title="Void" onClick={() => setVoidDialog(s.id)}><XCircle className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Void Confirmation */}
      <Dialog open={!!voidDialog} onOpenChange={(o) => { if (!o) setVoidDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Void Transaksi</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Transaksi ini akan di-void. Stok tidak otomatis dikembalikan. Lanjutkan?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => voidDialog && voidSale.mutate(voidDialog)} disabled={voidSale.isPending}>
              {voidSale.isPending ? "Memproses..." : "Ya, Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Receipt */}
      {printData && (
        <Dialog open={!!printData} onOpenChange={() => setPrintData(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle className="text-center">Struk Pembayaran</DialogTitle></DialogHeader>
            <div className="font-mono text-xs space-y-1 border rounded p-3">
              <p className="text-center font-bold text-sm">BINOWO KASIR</p>
              <p className="text-center text-muted-foreground">{new Date().toLocaleString("id-ID")}</p>
              <p className="text-center">{printData.no}</p>
              <div className="border-t border-dashed my-2" />
              {printData.items.map((item, i) => (
                <div key={i}>
                  <p>{item.product_name}</p>
                  <div className="flex justify-between">
                    <span>{item.qty} x {formatRp(item.selling_price)}</span>
                    <span>{formatRp(item.qty * item.selling_price)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatRp(printData.total)}</span></div>
              <div className="flex justify-between"><span>Bayar</span><span>{formatRp(printData.bayar)}</span></div>
              <div className="flex justify-between"><span>Kembali</span><span>{formatRp(printData.kembali)}</span></div>
              <div className="border-t border-dashed my-2" />
              <p className="text-center">Terima kasih!</p>
            </div>
            <DialogFooter>
              <Button className="w-full gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
