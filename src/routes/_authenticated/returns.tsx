import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useRequireShift } from "@/hooks/use-require-shift";

export const Route = createFileRoute("/_authenticated/returns")({ component: ReturnsPage });

type ReturnLine = { product_id: string; product_name: string; unit_name: string; qty: number; buy_price: number };
type ReturnDetail = { qty: number; unit_name: string; buy_price: number; products: { product_name: string } | null };
type ReturnHeader = { id: string; return_number: string; return_date: string; grand_total: number; suppliers: { supplier_name: string } | null; purchase_return_details: ReturnDetail[] };

const PAGE_SIZE = 10;

function ReturnsPage() {
  const { user } = useAuth();
  const { needsShift, isLoading: shiftLoading, hasOpenShift } = useRequireShift();
  const qc = useQueryClient();
  if (needsShift && shiftLoading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Memeriksa shift...</p></div>;
  if (needsShift && !hasOpenShift) return null;

  // Retur Pembelian form
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [searchProduct, setSearchProduct] = useState("");

  // Retur Pembelian filter + pagination
  const [showFilterP, setShowFilterP] = useState(false);
  const [filterPNoRetur, setFilterPNoRetur] = useState("");
  const [filterPFrom, setFilterPFrom] = useState("");
  const [filterPTo, setFilterPTo] = useState("");
  const [filterPSupplier, setFilterPSupplier] = useState("");
  const [filterPProduct, setFilterPProduct] = useState("");
  const [pageP, setPageP] = useState(1);

  // Retur Penjualan form
  const [openSalesReturn, setOpenSalesReturn] = useState(false);
  const [srCustomerId, setSrCustomerId] = useState("");
  const [srWarehouseId, setSrWarehouseId] = useState("");
  const [srNotes, setSrNotes] = useState("");
  const [srLines, setSrLines] = useState<ReturnLine[]>([]);
  const [srSearch, setSrSearch] = useState("");

  // Retur Penjualan filter + pagination
  const [showFilterS, setShowFilterS] = useState(false);
  const [filterSNoTrx, setFilterSNoTrx] = useState("");
  const [filterSFrom, setFilterSFrom] = useState("");
  const [filterSTo, setFilterSTo] = useState("");
  const [filterSCustomer, setFilterSCustomer] = useState("");
  const [filterSProduct, setFilterSProduct] = useState("");
  const [pageS, setPageS] = useState(1);

  const { data: returns = [] } = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_returns").select("id, return_number, return_date, grand_total, suppliers(supplier_name), purchase_return_details(qty, unit_name, buy_price, products(product_name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReturnHeader[];
    },
  });

  const { data: salesReturns = [] } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_headers").select("id, sales_number, transaction_date:created_at, grand_total, customers(customer_name), sales_details(qty, unit_name, selling_price, products(product_name))").eq("transaction_status", "VOID").is("deleted_at", null).order("created_at", { ascending: false });
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

  const { data: srProducts = [] } = useQuery({
    queryKey: ["pos-products-sr", srSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_name, default_unit, current_retail_price").is("deleted_at", null).limit(20);
      if (srSearch) q = q.ilike("product_name", `%${srSearch}%`);
      const { data } = await q; return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => { const { data } = await supabase.from("customers").select("id, customer_name").is("deleted_at", null).order("customer_name"); return data ?? []; },
  });

  useEffect(() => {
    if (warehouses.length > 0) {
      const utama = warehouses.find((w) => w.warehouse_name.toLowerCase().includes("utama")) ?? warehouses[0];
      if (!warehouseId) setWarehouseId(utama.id);
      if (!srWarehouseId) setSrWarehouseId(utama.id);
    }
  }, [warehouses]);

  // Filter retur pembelian
  const filteredReturns = returns.filter((r) => {
    if (filterPNoRetur && !r.return_number.toLowerCase().includes(filterPNoRetur.toLowerCase())) return false;
    if (filterPFrom && r.return_date < filterPFrom) return false;
    if (filterPTo && r.return_date > filterPTo + "T23:59:59") return false;
    if (filterPSupplier && !(r.suppliers?.supplier_name ?? "").toLowerCase().includes(filterPSupplier.toLowerCase())) return false;
    if (filterPProduct) {
      const hasProduct = (r.purchase_return_details ?? []).some((d) => d.products?.product_name?.toLowerCase().includes(filterPProduct.toLowerCase()));
      if (!hasProduct) return false;
    }
    return true;
  });
  const totalPagesP = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const pagedReturns = filteredReturns.slice((pageP - 1) * PAGE_SIZE, pageP * PAGE_SIZE);
  const isFilteredP = filterPNoRetur || filterPFrom || filterPTo || filterPSupplier || filterPProduct;

  // Filter retur penjualan
  const filteredSalesReturns = (salesReturns as any[]).filter((r) => {
    if (filterSNoTrx && !r.sales_number.toLowerCase().includes(filterSNoTrx.toLowerCase())) return false;
    if (filterSFrom && r.transaction_date < filterSFrom) return false;
    if (filterSTo && r.transaction_date > filterSTo + "T23:59:59") return false;
    if (filterSCustomer && !(r.customers?.customer_name ?? "").toLowerCase().includes(filterSCustomer.toLowerCase())) return false;
    if (filterSProduct) {
      const hasProduct = (r.sales_details ?? []).some((d: any) => d.products?.product_name?.toLowerCase().includes(filterSProduct.toLowerCase()));
      if (!hasProduct) return false;
    }
    return true;
  });
  const totalPagesS = Math.max(1, Math.ceil(filteredSalesReturns.length / PAGE_SIZE));
  const pagedSalesReturns = filteredSalesReturns.slice((pageS - 1) * PAGE_SIZE, pageS * PAGE_SIZE);
  const isFilteredS = filterSNoTrx || filterSFrom || filterSTo || filterSCustomer || filterSProduct;

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
      await supabase.from("purchase_return_details").insert(lines.map((l) => ({ return_id: rid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, buy_price: l.buy_price, total: l.qty * l.buy_price })) as never);
      await supabase.from("stock_movements").insert(lines.map((l) => ({ product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "return_out", reference_number: return_number, qty_out: l.qty, created_by: user!.id })) as never);
    },
    onSuccess: () => { toast.success("Retur berhasil disimpan"); qc.invalidateQueries(); setOpen(false); setLines([]); setSupplierId(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSalesReturn = useMutation({
    mutationFn: async () => {
      if (!srWarehouseId) throw new Error("Pilih gudang");
      if (srLines.length === 0) throw new Error("Tambah item dulu");
      const return_number = "RSL" + Date.now();
      const grand_total = srLines.reduce((s, l) => s + l.qty * l.buy_price, 0);
      const { data: header, error: he } = await supabase.from("sales_headers").insert({ sales_number: return_number, cashier_id: user!.id, subtotal: grand_total, grand_total, payment_method: "RETUR", transaction_status: "VOID", hold_status: false, customer_id: srCustomerId && srCustomerId !== "none" ? srCustomerId : null } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      await supabase.from("sales_details").insert(srLines.map((l) => ({ sales_id: sid, product_id: l.product_id, warehouse_id: srWarehouseId, qty: l.qty, unit_name: l.unit_name, selling_price: l.buy_price, total: l.qty * l.buy_price })) as never);
      await supabase.from("stock_movements").insert(srLines.map((l) => ({ product_id: l.product_id, warehouse_id: srWarehouseId, transaction_type: "sales_return", reference_number: return_number, qty_in: l.qty, created_by: user!.id })) as never);
    },
    onSuccess: () => { toast.success("Retur penjualan disimpan"); qc.invalidateQueries(); setOpenSalesReturn(false); setSrLines([]); setSrCustomerId(""); setSrNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pembelian">
        <TabsList><TabsTrigger value="pembelian">Retur Pembelian</TabsTrigger><TabsTrigger value="penjualan">Retur Penjualan</TabsTrigger></TabsList>

        {/* ===== TAB RETUR PEMBELIAN ===== */}
        <TabsContent value="pembelian" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{filteredReturns.length} data{isFilteredP ? " (difilter)" : ""}</p>
            <div className="flex gap-2">
              <Button variant={isFilteredP ? "default" : "outline"} className="gap-2" onClick={() => setShowFilterP((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />Filter{isFilteredP ? " (aktif)" : ""}
              </Button>
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
                            <span>{p.product_name}</span><span className="text-muted-foreground text-xs">{formatRp(p.current_buy_price)}</span>
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
                  <div className="flex justify-between font-bold text-lg border-t pt-3"><span>Total Retur</span><span className="text-red-500">{formatRp(grandTotal)}</span></div>
                  <DialogFooter><Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan Retur"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {showFilterP && (
            <Card className="border-dashed"><CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>No. Retur</Label><Input placeholder="Cari no. retur..." value={filterPNoRetur} onChange={(e) => { setFilterPNoRetur(e.target.value); setPageP(1); }} /></div>
                <div className="space-y-1.5"><Label>Supplier</Label><Input placeholder="Cari supplier..." value={filterPSupplier} onChange={(e) => { setFilterPSupplier(e.target.value); setPageP(1); }} /></div>
                <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterPFrom} onChange={(e) => { setFilterPFrom(e.target.value); setPageP(1); }} /></div>
                <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterPTo} onChange={(e) => { setFilterPTo(e.target.value); setPageP(1); }} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Produk</Label><Input placeholder="Cari nama produk..." value={filterPProduct} onChange={(e) => { setFilterPProduct(e.target.value); setPageP(1); }} /></div>
              </div>
              {isFilteredP && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setFilterPNoRetur(""); setFilterPFrom(""); setFilterPTo(""); setFilterPSupplier(""); setFilterPProduct(""); setPageP(1); }}>Reset Filter</Button>}
            </CardContent></Card>
          )}

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Retur</TableHead><TableHead>Tanggal</TableHead><TableHead>Supplier</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {pagedReturns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada retur pembelian.</TableCell></TableRow>}
                {pagedReturns.map((r) => (
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
            {totalPagesP > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Halaman {pageP} dari {totalPagesP} ({filteredReturns.length} data)</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={pageP === 1} onClick={() => setPageP((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={pageP === totalPagesP} onClick={() => setPageP((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ===== TAB RETUR PENJUALAN ===== */}
        <TabsContent value="penjualan" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{filteredSalesReturns.length} data{isFilteredS ? " (difilter)" : ""}</p>
            <div className="flex gap-2">
              <Button variant={isFilteredS ? "default" : "outline"} className="gap-2" onClick={() => setShowFilterS((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />Filter{isFilteredS ? " (aktif)" : ""}
              </Button>
              <Dialog open={openSalesReturn} onOpenChange={setOpenSalesReturn}>
                <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Buat Retur</Button></DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Retur Penjualan</DialogTitle></DialogHeader>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label>Customer</Label>
                        <Select value={srCustomerId} onValueChange={setSrCustomerId}>
                          <SelectTrigger><SelectValue placeholder="Umum / Walk-in" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Umum / Walk-in</SelectItem>
                            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Gudang *</Label>
                        <Select value={srWarehouseId} onValueChange={setSrWarehouseId}>
                          <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                          <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Catatan</Label><Input value={srNotes} onChange={(e) => setSrNotes(e.target.value)} placeholder="Alasan retur..." /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cari Barang</Label>
                      <Input autoFocus placeholder="Cari nama barang..." value={srSearch} onChange={(e) => setSrSearch(e.target.value)} />
                      <div className="border rounded max-h-48 overflow-y-auto divide-y">
                        {srProducts.map((p) => (
                          <div key={p.id} className="p-2 flex justify-between text-sm hover:bg-accent cursor-pointer" onClick={() => setSrLines((prev) => prev.find((l) => l.product_id === p.id) ? prev : [...prev, { product_id: p.id, product_name: p.product_name, unit_name: p.default_unit, qty: 1, buy_price: Number(p.current_retail_price) }])}>
                            <span>{p.product_name}</span><span className="text-muted-foreground text-xs">{formatRp(p.current_retail_price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="border rounded divide-y mt-2">
                    {srLines.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Belum ada item</p>}
                    {srLines.map((l, i) => (
                      <div key={i} className="p-2 grid grid-cols-[1fr_80px_120px_100px_40px] gap-2 items-center text-sm">
                        <span className="truncate font-medium">{l.product_name}</span>
                        <Input type="number" min={1} value={l.qty} onChange={(e) => setSrLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8" />
                        <Input type="number" value={l.buy_price} onChange={(e) => setSrLines((ls) => ls.map((x, j) => j === i ? { ...x, buy_price: Number(e.target.value) } : x))} className="h-8" />
                        <span className="text-right text-muted-foreground">{formatRp(l.qty * l.buy_price)}</span>
                        <Button size="icon" variant="ghost" onClick={() => setSrLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-3"><span>Total Retur</span><span className="text-red-500">{formatRp(srLines.reduce((s, l) => s + l.qty * l.buy_price, 0))}</span></div>
                  <DialogFooter><Button size="lg" onClick={() => saveSalesReturn.mutate()} disabled={saveSalesReturn.isPending}>{saveSalesReturn.isPending ? "Menyimpan..." : "Simpan Retur"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {showFilterS && (
            <Card className="border-dashed"><CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>No. Transaksi</Label><Input placeholder="Cari no. transaksi..." value={filterSNoTrx} onChange={(e) => { setFilterSNoTrx(e.target.value); setPageS(1); }} /></div>
                <div className="space-y-1.5"><Label>Customer</Label><Input placeholder="Cari customer..." value={filterSCustomer} onChange={(e) => { setFilterSCustomer(e.target.value); setPageS(1); }} /></div>
                <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterSFrom} onChange={(e) => { setFilterSFrom(e.target.value); setPageS(1); }} /></div>
                <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterSTo} onChange={(e) => { setFilterSTo(e.target.value); setPageS(1); }} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Produk</Label><Input placeholder="Cari nama produk..." value={filterSProduct} onChange={(e) => { setFilterSProduct(e.target.value); setPageS(1); }} /></div>
              </div>
              {isFilteredS && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setFilterSNoTrx(""); setFilterSFrom(""); setFilterSTo(""); setFilterSCustomer(""); setFilterSProduct(""); setPageS(1); }}>Reset Filter</Button>}
            </CardContent></Card>
          )}

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Tanggal</TableHead><TableHead>Customer</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {pagedSalesReturns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada retur penjualan.</TableCell></TableRow>}
                {pagedSalesReturns.map((r: any) => (
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
            {totalPagesS > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Halaman {pageS} dari {totalPagesS} ({filteredSalesReturns.length} data)</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={pageS === 1} onClick={() => setPageS((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={pageS === totalPagesS} onClick={() => setPageS((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
