import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingBag, SlidersHorizontal, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/purchases")({ component: PurchasesPage });

type PurchaseLine = { product_id: string; product_name: string; unit_name: string; qty: number; buy_price: number; retail_price: number; wholesale_price: number };
type PurchaseDetail = { qty: number; unit_name: string; buy_price: number; products: { product_name: string } | null };
type PurchaseHeader = { id: string; purchase_number: string; transaction_date: string; grand_total: number; suppliers: { supplier_name: string } | null; purchase_details: PurchaseDetail[] };

const PAGE_SIZE = 10;

function exportCSV(data: PurchaseHeader[], filterInfo: string) {
  const rows: string[] = [];
  rows.push("Laporan Pembelian");
  rows.push(filterInfo);
  rows.push("");
  rows.push("No. PO,Tanggal,Supplier,Produk,Qty,Satuan,Harga Beli,Subtotal Item,Total PO");
  for (const h of data) {
    const details = h.purchase_details ?? [];
    if (details.length === 0) {
      rows.push([
        h.purchase_number,
        new Date(h.transaction_date).toLocaleDateString("id-ID"),
        h.suppliers?.supplier_name ?? "-",
        "", "", "", "", "",
        h.grand_total,
      ].map(String).join(","));
    } else {
      details.forEach((d, i) => {
        rows.push([
          i === 0 ? h.purchase_number : "",
          i === 0 ? new Date(h.transaction_date).toLocaleDateString("id-ID") : "",
          i === 0 ? (h.suppliers?.supplier_name ?? "-") : "",
          d.products?.product_name ?? "-",
          d.qty,
          d.unit_name,
          d.buy_price,
          d.qty * d.buy_price,
          i === 0 ? h.grand_total : "",
        ].map(String).join(","));
      });
    }
  }
  rows.push("");
  const grandTotal = data.reduce((s, h) => s + Number(h.grand_total), 0);
  rows.push(`,,,,,,,Total Keseluruhan,${grandTotal}`);

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-pembelian-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PurchasesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("LUNAS");
  const [dueDate, setDueDate] = useState("");
  const [searchProduct, setSearchProduct] = useState("");

  const [showFilter, setShowFilter] = useState(false);
  const [filterNoPO, setFilterNoPO] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [page, setPage] = useState(1);

  const { data: headers = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_headers")
        .select("id, purchase_number, transaction_date, grand_total, suppliers(supplier_name), purchase_details(qty, unit_name, buy_price, products(product_name))")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PurchaseHeader[];
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

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const utama = warehouses.find((w: any) => w.warehouse_name.toLowerCase().includes("utama")) ?? warehouses[0];
      setWarehouseId(utama.id);
    }
  }, [warehouses]);

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

  const filtered = useMemo(() => {
    return headers.filter((h) => {
      if (filterNoPO && !h.purchase_number.toLowerCase().includes(filterNoPO.toLowerCase())) return false;
      if (filterFrom && h.transaction_date < filterFrom) return false;
      if (filterTo && h.transaction_date > filterTo + "T23:59:59") return false;
      if (filterSupplier && !(h.suppliers?.supplier_name ?? "").toLowerCase().includes(filterSupplier.toLowerCase())) return false;
      if (filterProduct) {
        const has = (h.purchase_details ?? []).some((d) => d.products?.product_name?.toLowerCase().includes(filterProduct.toLowerCase()));
        if (!has) return false;
      }
      return true;
    });
  }, [headers, filterNoPO, filterFrom, filterTo, filterSupplier, filterProduct]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFiltered = filterNoPO || filterFrom || filterTo || filterSupplier || filterProduct;

  function resetFilter() { setFilterNoPO(""); setFilterFrom(""); setFilterTo(""); setFilterSupplier(""); setFilterProduct(""); setPage(1); }

  function buildFilterInfo() {
    const parts: string[] = [];
    if (filterFrom || filterTo) parts.push(`Tanggal: ${filterFrom || "awal"} s/d ${filterTo || "akhir"}`);
    if (filterSupplier) parts.push(`Supplier: ${filterSupplier}`);
    if (filterNoPO) parts.push(`No. PO: ${filterNoPO}`);
    if (filterProduct) parts.push(`Produk: ${filterProduct}`);
    return parts.length > 0 ? "Filter: " + parts.join(" | ") : "Semua data";
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
    onSuccess: () => { toast.success("Pembelian disimpan"); qc.invalidateQueries(); setOpen(false); setLines([]); setSupplierId(""); setWarehouseId(""); setInvoiceNumber(""); setDueDate(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} pembelian{isFiltered ? " (difilter)" : ""}</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant={isFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowFilter((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Filter{isFiltered ? " (aktif)" : ""}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => exportCSV(filtered, buildFilterInfo())}>
            <Download className="h-4 w-4" />Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Buat Pembelian</Button></DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Pembelian Baru</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
                      <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Gudang *</Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                      <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                      <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>No. Invoice</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Opsional" /></div>
                  <div className="space-y-1.5"><Label>Status Pembayaran</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LUNAS">Lunas</SelectItem>
                        <SelectItem value="HUTANG">Hutang</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentStatus === "HUTANG" && (
                    <div className="space-y-1.5"><Label>Jatuh Tempo</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Cari Barang</Label>
                  <Input autoFocus placeholder="Cari nama / kode..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                  <div className="border rounded max-h-48 overflow-y-auto divide-y">
                    {products.map((p: any) => (
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
      </div>

      {showFilter && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>No. PO</Label><Input placeholder="Cari no. PO..." value={filterNoPO} onChange={(e) => { setFilterNoPO(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Supplier</Label><Input placeholder="Cari supplier..." value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Produk</Label><Input placeholder="Cari nama produk..." value={filterProduct} onChange={(e) => { setFilterProduct(e.target.value); setPage(1); }} /></div>
            </div>
            {isFiltered && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={resetFilter}>Reset Filter</Button>}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>No. PO</TableHead><TableHead>Tanggal</TableHead><TableHead>Supplier</TableHead><TableHead>Ringkasan Produk</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada pembelian.</TableCell></TableRow>}
            {paged.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-mono text-xs">{h.purchase_number}</TableCell>
                <TableCell className="text-xs">{new Date(h.transaction_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>{h.suppliers?.supplier_name ?? "-"}</TableCell>
                <TableCell className="text-xs max-w-[220px]">
                  {(h.purchase_details ?? []).slice(0, 3).map((d, i) => (
                    <div key={i} className="truncate">{d.products?.product_name} <span className="text-muted-foreground">×{d.qty} {d.unit_name} @ {formatRp(d.buy_price)}</span></div>
                  ))}
                  {(h.purchase_details ?? []).length > 3 && <div className="text-muted-foreground">+{(h.purchase_details ?? []).length - 3} lainnya</div>}
                </TableCell>
                <TableCell className="text-right font-medium">{formatRp(h.grand_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>Halaman {page} dari {totalPages} ({filtered.length} data)</span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
