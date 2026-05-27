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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package2, Tag, AlertTriangle, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/log-activity";

export const Route = createFileRoute("/_authenticated/master-inventory")({ component: MasterInventoryPage });

type Product = { product_id: string; product_code: string; product_name: string; barcode: string | null; default_unit: string; current_buy_price: number; current_retail_price: number; current_wholesale_price: number; minimum_stock: number; current_stock: number; supplier_id: string | null; is_active: boolean; deleted_at: string | null };
type StockMovement = { id: string; movement_date: string; transaction_type: string; reference_number: string; qty_in: number; qty_out: number; balance_after: number | null; products: { product_name: string; product_code: string } | null; warehouses: { warehouse_name: string } | null };
type PriceHistory = { id: string; change_date: string; old_buy_price: number; new_buy_price: number; old_retail_price: number; new_retail_price: number; old_wholesale_price: number; new_wholesale_price: number; products: { product_name: string; product_code: string } | null };
type AdjLine = { product_id: string; product_name: string; unit_name: string; qty_system_before: number; qty_system: number; qty_actual: number };
type TransferLine = { product_id: string; product_name: string; unit_name: string; qty: number };

function MasterInventoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Products state
  const [editing, setEditing] = useState<Product | null>(null);
  const [openProduct, setOpenProduct] = useState(false);
  const [showFilterBarang, setShowFilterBarang] = useState(false);
  const [filterBarangKode, setFilterBarangKode] = useState("");
  const [filterBarangNama, setFilterBarangNama] = useState("");
  const [pageBarang, setPageBarang] = useState(1);
  const BARANG_PAGE_SIZE = 10;

  // Adjustment state
  const [openAdj, setOpenAdj] = useState(false);
  const [adjWarehouse, setAdjWarehouse] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjLines, setAdjLines] = useState<AdjLine[]>([]);
  const [adjSearch, setAdjSearch] = useState("");

  // Transfer state
  const [openTransfer, setOpenTransfer] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferLines, setTransferLines] = useState<TransferLine[]>([]);
  const [transferSearch, setTransferSearch] = useState("");

  // Movement filter + pagination
  const [showFilterMov, setShowFilterMov] = useState(false);
  const [filterMovFrom, setFilterMovFrom] = useState("");
  const [filterMovTo, setFilterMovTo] = useState("");
  const [filterMovTipe, setFilterMovTipe] = useState("");
  const [filterMovRef, setFilterMovRef] = useState("");
  const [filterMovBarang, setFilterMovBarang] = useState("");
  const [filterMovGudang, setFilterMovGudang] = useState("");
  const [pageMov, setPageMov] = useState(1);
  const MOV_PAGE_SIZE = 10;

  // Riwayat harga filter + pagination
  const [showFilterPrice, setShowFilterPrice] = useState(false);
  const [filterPriceFrom, setFilterPriceFrom] = useState("");
  const [filterPriceTo, setFilterPriceTo] = useState("");
  const [filterPriceBarang, setFilterPriceBarang] = useState("");
  const [pagePrice, setPagePrice] = useState(1);
  const PRICE_PAGE_SIZE = 10;

  const { data: products = [], refetch: refetchProducts } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_stock_summary").select("*").is("deleted_at", null).eq("is_active", true).order("product_name").limit(500);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const filteredBarang = products.filter((p) => {
    if (filterBarangKode && !p.product_code.toLowerCase().includes(filterBarangKode.toLowerCase())) return false;
    if (filterBarangNama && !p.product_name.toLowerCase().includes(filterBarangNama.toLowerCase())) return false;
    return true;
  });
  const totalPagesBarang = Math.max(1, Math.ceil(filteredBarang.length / BARANG_PAGE_SIZE));
  const pagedBarang = filteredBarang.slice((pageBarang - 1) * BARANG_PAGE_SIZE, pageBarang * BARANG_PAGE_SIZE);
  const isFilteredBarang = filterBarangKode || filterBarangNama;

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => { const { data } = await supabase.from("suppliers").select("id, supplier_name").is("deleted_at", null).order("supplier_name"); return data ?? []; },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("id, movement_date, transaction_type, reference_number, qty_in, qty_out, balance_after, products(product_name, product_code), warehouses(warehouse_name)").order("movement_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
  });

  const filteredMov = movements.filter((m) => {
    const dateStr = m.movement_date.slice(0, 10);
    if (filterMovFrom && dateStr < filterMovFrom) return false;
    if (filterMovTo && dateStr > filterMovTo) return false;
    if (filterMovTipe && !m.transaction_type.toLowerCase().includes(filterMovTipe.toLowerCase())) return false;
    if (filterMovRef && !m.reference_number.toLowerCase().includes(filterMovRef.toLowerCase())) return false;
    if (filterMovBarang && !(m.products?.product_name ?? "").toLowerCase().includes(filterMovBarang.toLowerCase())) return false;
    if (filterMovGudang && !(m.warehouses?.warehouse_name ?? "").toLowerCase().includes(filterMovGudang.toLowerCase())) return false;
    return true;
  });
  const totalPagesMov = Math.max(1, Math.ceil(filteredMov.length / MOV_PAGE_SIZE));
  const pagedMov = filteredMov.slice((pageMov - 1) * MOV_PAGE_SIZE, pageMov * MOV_PAGE_SIZE);
  const isFilteredMov = filterMovFrom || filterMovTo || filterMovTipe || filterMovRef || filterMovBarang || filterMovGudang;

  const { data: priceHistory = [] } = useQuery({
    queryKey: ["inventory-price-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_history").select("id, change_date, old_buy_price, new_buy_price, old_retail_price, new_retail_price, old_wholesale_price, new_wholesale_price, products(product_name, product_code)").order("change_date", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as PriceHistory[];
    },
  });

  const filteredPrice = priceHistory.filter((h) => {
    const dateStr = h.change_date.slice(0, 10);
    if (filterPriceFrom && dateStr < filterPriceFrom) return false;
    if (filterPriceTo && dateStr > filterPriceTo) return false;
    if (filterPriceBarang && !(h.products?.product_name ?? "").toLowerCase().includes(filterPriceBarang.toLowerCase()) && !(h.products?.product_code ?? "").toLowerCase().includes(filterPriceBarang.toLowerCase())) return false;
    return true;
  });
  const totalPagesPrice = Math.max(1, Math.ceil(filteredPrice.length / PRICE_PAGE_SIZE));
  const pagedPrice = filteredPrice.slice((pagePrice - 1) * PRICE_PAGE_SIZE, pagePrice * PRICE_PAGE_SIZE);
  const isFilteredPrice = filterPriceFrom || filterPriceTo || filterPriceBarang;

  const { data: adjustments = [] } = useQuery({
    queryKey: ["inventory-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_adjustments")
        .select("id, adjustment_number, adjustment_date, warehouses(warehouse_name), stock_adjustment_details(product_id, qty_system_before, qty_system, qty_actual, qty_difference, products(product_name, product_code))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["inventory-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_transfers").select("id, transfer_number, transfer_date, status, from_warehouse:from_warehouse_id(warehouse_name), to_warehouse:to_warehouse_id(warehouse_name)").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (warehouses.length > 0 && !adjWarehouse) {
      const utama = warehouses.find((w) => w.warehouse_name.toLowerCase().includes("utama")) ?? warehouses[0];
      setAdjWarehouse(utama.id);
      setFromWarehouse(utama.id);
    }
  }, [warehouses]);

  // Realtime subscription untuk stok
  useEffect(() => {
    const channel = supabase.channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => {
        qc.invalidateQueries({ queryKey: ["inventory-products"] });
        qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_headers" }, () => {
        qc.invalidateQueries({ queryKey: ["inventory-products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_headers" }, () => {
        qc.invalidateQueries({ queryKey: ["inventory-products"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const saveProduct = useMutation({
    mutationFn: async (form: Partial<Product> & { product_code: string; product_name: string }) => {
      if (editing) {
        const { error } = await supabase.from("products").update({ product_code: form.product_code, product_name: form.product_name, barcode: form.barcode, default_unit: form.default_unit, current_buy_price: form.current_buy_price, current_retail_price: form.current_retail_price, current_wholesale_price: form.current_wholesale_price, minimum_stock: form.minimum_stock, supplier_id: form.supplier_id } as never).eq("id", editing.product_id);
        if (error) throw error;
        if (form.current_stock !== editing.current_stock) {
          const diff = form.current_stock - editing.current_stock;
          const adjNumber = "ADJ" + Date.now();
          const { data: wh } = await supabase.from("warehouses").select("id").eq("is_active", true).order("warehouse_name").limit(1).single();
          const whId = (wh as any)?.id;
          const { error: me } = await supabase.from("stock_movements").insert({ product_id: editing.product_id, warehouse_id: whId, transaction_type: "adjustment", reference_number: adjNumber, qty_in: diff > 0 ? diff : 0, qty_out: diff < 0 ? Math.abs(diff) : 0, created_by: user!.id } as never);
          if (me) throw me;
        }
      } else {
        const { error } = await supabase.from("products").insert({ product_code: form.product_code, product_name: form.product_name, barcode: form.barcode, default_unit: form.default_unit, current_buy_price: form.current_buy_price, current_retail_price: form.current_retail_price, current_wholesale_price: form.current_wholesale_price, minimum_stock: form.minimum_stock, supplier_id: form.supplier_id, is_active: true } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Barang disimpan"); void logActivity(user?.id, editing ? "UPDATE" : "CREATE", editing ? `Barang diupdate: ${editing.product_name}` : "Barang baru ditambahkan", "products"); qc.invalidateQueries({ queryKey: ["inventory-products"] }); qc.invalidateQueries({ queryKey: ["inventory-movements"] }); setOpenProduct(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Barang dihapus"); void logActivity(user?.id, "DELETE", "Barang dihapus", "products"); qc.invalidateQueries({ queryKey: ["inventory-products"] }); },
  });

  const saveAdjustment = useMutation({
    mutationFn: async () => {
      if (!adjWarehouse) throw new Error("Pilih gudang");
      if (adjLines.length === 0) throw new Error("Tambah item dulu");
      const adjustment_number = "ADJ" + Date.now();
      const { data: header, error: he } = await supabase.from("stock_adjustments").insert({ adjustment_number, warehouse_id: adjWarehouse, notes: adjNotes, created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const aid = (header as { id: string }).id;
      await supabase.from("stock_adjustment_details").insert(adjLines.map((l) => ({ adjustment_id: aid, product_id: l.product_id, qty_system_before: l.qty_system_before, qty_system: l.qty_system, qty_actual: l.qty_actual, qty_difference: l.qty_actual - l.qty_system })) as never);
      const movements = adjLines.filter((l) => l.qty_actual !== l.qty_system).map((l) => {
        const diff = l.qty_actual - l.qty_system;
        return { product_id: l.product_id, warehouse_id: adjWarehouse, transaction_type: "adjustment", reference_number: adjustment_number, qty_in: diff > 0 ? diff : 0, qty_out: diff < 0 ? Math.abs(diff) : 0, created_by: user!.id };
      });
      if (movements.length > 0) await supabase.from("stock_movements").insert(movements as never);
    },
    onSuccess: () => { toast.success("Adjustment disimpan"); qc.invalidateQueries(); setOpenAdj(false); setAdjLines([]); setAdjNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTransfer = useMutation({
    mutationFn: async () => {
      if (!fromWarehouse || !toWarehouse) throw new Error("Pilih gudang asal dan tujuan");
      if (fromWarehouse === toWarehouse) throw new Error("Gudang asal dan tujuan tidak boleh sama");
      if (transferLines.length === 0) throw new Error("Tambah item dulu");
      const transfer_number = "TRF" + Date.now();
      const { data: header, error: he } = await supabase.from("stock_transfers").insert({ transfer_number, from_warehouse_id: fromWarehouse, to_warehouse_id: toWarehouse, notes: transferNotes, status: "SELESAI", created_by: user!.id } as never).select("id").single();
      if (he) throw he;
      const tid = (header as { id: string }).id;
      await supabase.from("stock_transfer_details").insert(transferLines.map((l) => ({ transfer_id: tid, product_id: l.product_id, qty: l.qty, unit_name: l.unit_name })) as never);
      await supabase.from("stock_movements").insert([
        ...transferLines.map((l) => ({ product_id: l.product_id, warehouse_id: fromWarehouse, transaction_type: "transfer_out", reference_number: transfer_number, qty_out: l.qty, created_by: user!.id })),
        ...transferLines.map((l) => ({ product_id: l.product_id, warehouse_id: toWarehouse, transaction_type: "transfer_in", reference_number: transfer_number, qty_in: l.qty, created_by: user!.id })),
      ] as never);
    },
    onSuccess: () => { toast.success("Transfer stok berhasil"); qc.invalidateQueries(); setOpenTransfer(false); setTransferLines([]); setTransferNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeLabel: Record<string, string> = { purchase: "purchase", sale: "sale", adjustment: "adjustment", transfer_in: "transfer_in", transfer_out: "transfer_out", sales_return: "sales_return", return_out: "purchase_return" };
  const typeClass: Record<string, string> = { purchase: "bg-blue-100 text-blue-700 border border-blue-200", sale: "bg-red-100 text-red-700 border border-red-200", adjustment: "bg-gray-100 text-gray-600 border border-gray-200", transfer_in: "bg-green-100 text-green-700 border border-green-200", transfer_out: "bg-yellow-100 text-yellow-700 border border-yellow-200", sales_return: "bg-red-50 text-red-400 border border-red-200", return_out: "bg-blue-50 text-blue-400 border border-blue-200" };


  function priceDiff(o: number, n: number) {
    const d = n - o;
    if (d === 0) return null;
    return <span className={d > 0 ? "text-green-600 text-xs ml-1" : "text-red-500 text-xs ml-1"}>{d > 0 ? "▲" : "▼"}{formatRp(Math.abs(d))}</span>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="barang">
        <TabsList className="flex-wrap">
          <TabsTrigger value="barang">Master Barang</TabsTrigger>
          <TabsTrigger value="harga">Riwayat Harga</TabsTrigger>
          <TabsTrigger value="movement">Movement Stok</TabsTrigger>
          
          <TabsTrigger value="transfer">Transfer Stok</TabsTrigger>
        </TabsList>

        {/* TAB MASTER BARANG */}
        <TabsContent value="barang" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredBarang.length} barang{isFilteredBarang ? " (difilter)" : ""}</p>
            <div className="flex gap-2">
              <Button variant={isFilteredBarang ? "default" : "outline"} className="gap-2" onClick={() => setShowFilterBarang((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />Filter{isFilteredBarang ? " (aktif)" : ""}
              </Button>
              <Dialog open={openProduct} onOpenChange={(o) => { setOpenProduct(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Tambah Barang</Button></DialogTrigger>
                <ProductForm editing={editing} suppliers={suppliers} onSubmit={(f) => saveProduct.mutate(f as any)} loading={saveProduct.isPending} />
              </Dialog>
            </div>
          </div>
          {showFilterBarang && (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Kode Barang</Label><Input placeholder="Cari kode..." value={filterBarangKode} onChange={(e) => { setFilterBarangKode(e.target.value); setPageBarang(1); }} /></div>
                  <div className="space-y-1.5"><Label>Nama Barang</Label><Input placeholder="Cari nama..." value={filterBarangNama} onChange={(e) => { setFilterBarangNama(e.target.value); setPageBarang(1); }} /></div>
                </div>
                {isFilteredBarang && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setFilterBarangKode(""); setFilterBarangNama(""); setPageBarang(1); }}>Reset Filter</Button>}
              </CardContent>
            </Card>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Satuan</TableHead><TableHead className="text-right">Stok</TableHead><TableHead className="text-right">Harga Beli</TableHead><TableHead className="text-right">Retail</TableHead><TableHead className="text-right">Grosir</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
              <TableBody>
                {pagedBarang.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada barang.</TableCell></TableRow>}
                {pagedBarang.map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-xs">{p.default_unit}</TableCell>
                    <TableCell className="text-right">
                      <span className={["font-bold text-sm", p.current_stock <= 0 ? "text-red-500" : p.current_stock <= p.minimum_stock ? "text-orange-500" : "text-green-600"].join(" ")}>
                        {p.current_stock}
                      </span>
                      {p.current_stock <= p.minimum_stock && p.minimum_stock > 0 && <AlertTriangle className="inline h-3 w-3 text-orange-400 ml-1" />}
                    </TableCell>
                    <TableCell className="text-right text-xs">{formatRp(p.current_buy_price)}</TableCell>
                    <TableCell className="text-right text-xs">{formatRp(p.current_retail_price)}</TableCell>
                    <TableCell className="text-right text-xs">{formatRp(p.current_wholesale_price)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpenProduct(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus barang?")) deleteProduct.mutate(p.product_id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPagesBarang > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Halaman {pageBarang} dari {totalPagesBarang} ({filteredBarang.length} data)</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={pageBarang === 1} onClick={() => setPageBarang((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={pageBarang === totalPagesBarang} onClick={() => setPageBarang((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* TAB MOVEMENT STOK */}
        <TabsContent value="movement" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredMov.length} data{isFilteredMov ? " (difilter)" : ""}</p>
            <Button variant={isFilteredMov ? "default" : "outline"} className="gap-2" onClick={() => setShowFilterMov((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" />Filter{isFilteredMov ? " (aktif)" : ""}
            </Button>
          </div>
          {showFilterMov && (
            <Card className="border-dashed"><CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterMovFrom} onChange={(e) => { setFilterMovFrom(e.target.value); setPageMov(1); }} /></div>
                <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterMovTo} onChange={(e) => { setFilterMovTo(e.target.value); setPageMov(1); }} /></div>
                <div className="space-y-1.5"><Label>Tipe</Label><Input placeholder="Cari tipe..." value={filterMovTipe} onChange={(e) => { setFilterMovTipe(e.target.value); setPageMov(1); }} /></div>
                <div className="space-y-1.5"><Label>Referensi</Label><Input placeholder="Cari no. referensi..." value={filterMovRef} onChange={(e) => { setFilterMovRef(e.target.value); setPageMov(1); }} /></div>
                <div className="space-y-1.5"><Label>Barang</Label><Input placeholder="Cari nama barang..." value={filterMovBarang} onChange={(e) => { setFilterMovBarang(e.target.value); setPageMov(1); }} /></div>
                <div className="space-y-1.5"><Label>Gudang</Label><Input placeholder="Cari gudang..." value={filterMovGudang} onChange={(e) => { setFilterMovGudang(e.target.value); setPageMov(1); }} /></div>
              </div>
              {isFilteredMov && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setFilterMovFrom(""); setFilterMovTo(""); setFilterMovTipe(""); setFilterMovRef(""); setFilterMovBarang(""); setFilterMovGudang(""); setPageMov(1); }}>Reset Filter</Button>}
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Tipe</TableHead><TableHead>Referensi</TableHead><TableHead>Barang</TableHead><TableHead>Gudang</TableHead><TableHead className="text-right">Masuk</TableHead><TableHead className="text-right">Keluar</TableHead></TableRow></TableHeader>
              <TableBody>
                {pagedMov.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data.</TableCell></TableRow>}
                {pagedMov.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.movement_date).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell><span className={["text-xs px-2 py-1 rounded-full font-medium", typeClass[m.transaction_type] ?? "bg-gray-100 text-gray-600"].join(" ")}>{typeLabel[m.transaction_type] ?? m.transaction_type}</span></TableCell>
                    <TableCell className="font-mono text-xs">{m.reference_number}</TableCell>
                    <TableCell className="text-sm">{m.products?.product_name ?? "-"}<span className="text-muted-foreground text-xs ml-1">({m.products?.product_code})</span></TableCell>
                    <TableCell className="text-xs">{m.warehouses?.warehouse_name ?? "-"}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">{m.qty_in > 0 ? `+${m.qty_in}` : "-"}</TableCell>
                    <TableCell className="text-right text-red-500 font-medium">{m.qty_out > 0 ? `-${m.qty_out}` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPagesMov > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Halaman {pageMov} dari {totalPagesMov} ({filteredMov.length} data)</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={pageMov === 1} onClick={() => setPageMov((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={pageMov === totalPagesMov} onClick={() => setPageMov((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* TAB RIWAYAT HARGA */}
        <TabsContent value="harga" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredPrice.length} data{isFilteredPrice ? " (difilter)" : ""}</p>
            <Button variant={isFilteredPrice ? "default" : "outline"} className="gap-2" onClick={() => setShowFilterPrice((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" />Filter{isFilteredPrice ? " (aktif)" : ""}
            </Button>
          </div>
          {showFilterPrice && (
            <Card className="border-dashed"><CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={filterPriceFrom} onChange={(e) => { setFilterPriceFrom(e.target.value); setPagePrice(1); }} /></div>
                <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={filterPriceTo} onChange={(e) => { setFilterPriceTo(e.target.value); setPagePrice(1); }} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Barang</Label><Input placeholder="Cari nama / kode barang..." value={filterPriceBarang} onChange={(e) => { setFilterPriceBarang(e.target.value); setPagePrice(1); }} /></div>
              </div>
              {isFilteredPrice && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setFilterPriceFrom(""); setFilterPriceTo(""); setFilterPriceBarang(""); setPagePrice(1); }}>Reset Filter</Button>}
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Barang</TableHead><TableHead className="text-right">Beli Lama</TableHead><TableHead className="text-right">Beli Baru</TableHead><TableHead className="text-right">Retail Lama</TableHead><TableHead className="text-right">Retail Baru</TableHead><TableHead className="text-right">Grosir Lama</TableHead><TableHead className="text-right">Grosir Baru</TableHead></TableRow></TableHeader>
              <TableBody>
                {pagedPrice.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada riwayat harga.</TableCell></TableRow>}
                {pagedPrice.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.change_date).toLocaleString("id-ID")}</TableCell>
                    <TableCell><p className="font-medium text-sm">{h.products?.product_name ?? "-"}</p><p className="text-xs text-muted-foreground">{h.products?.product_code}</p></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_buy_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatRp(h.new_buy_price)}{priceDiff(h.old_buy_price, h.new_buy_price)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_retail_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatRp(h.new_retail_price)}{priceDiff(h.old_retail_price, h.new_retail_price)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_wholesale_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatRp(h.new_wholesale_price)}{priceDiff(h.old_wholesale_price, h.new_wholesale_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPagesPrice > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Halaman {pagePrice} dari {totalPagesPrice} ({filteredPrice.length} data)</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={pagePrice === 1} onClick={() => setPagePrice((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={pagePrice === totalPagesPrice} onClick={() => setPagePrice((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* TAB TRANSFER STOK */}
        <TabsContent value="transfer" className="space-y-3">
          <div className="flex items-center justify-between">
            <div />
            <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
              <Button size="lg" onClick={() => toast.info("Layanan ini belum tersedia")} type="button"><Plus className="h-4 w-4 mr-1" />Transfer Stok</Button>
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
                    <div className="space-y-1.5"><Label>Catatan</Label><Input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="Opsional" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cari Barang</Label>
                    <Input autoFocus placeholder="Cari nama barang..." value={transferSearch} onChange={(e) => setTransferSearch(e.target.value)} />
                    <div className="border rounded max-h-48 overflow-y-auto divide-y">
                      {products.filter((p) => !transferSearch || p.product_name.toLowerCase().includes(transferSearch.toLowerCase())).slice(0, 10).map((p) => (
                        <div key={p.product_id} className="p-2 flex justify-between text-sm hover:bg-accent cursor-pointer" onClick={() => setTransferLines((prev) => prev.find((l) => l.product_id === p.product_id) ? prev : [...prev, { product_id: p.product_id, product_name: p.product_name, unit_name: p.default_unit, qty: 1 }])}>
                          <span>{p.product_name}</span>
                          <span className="text-muted-foreground text-xs">Stok: {p.current_stock}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border rounded divide-y mt-2">
                  {transferLines.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Belum ada item</p>}
                  {transferLines.map((l, i) => (
                    <div key={i} className="p-2 grid grid-cols-[1fr_80px_40px] gap-2 items-center text-sm">
                      <span className="truncate font-medium">{l.product_name}</span>
                      <Input type="number" min={1} value={l.qty} onChange={(e) => setTransferLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8" />
                      <Button size="icon" variant="ghost" onClick={() => setTransferLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <DialogFooter><Button size="lg" onClick={() => saveTransfer.mutate()} disabled={saveTransfer.isPending}>{saveTransfer.isPending ? "Menyimpan..." : "Simpan Transfer"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>No. Transfer</TableHead><TableHead>Tanggal</TableHead><TableHead>Dari</TableHead><TableHead>Ke</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {transfers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada transfer.</TableCell></TableRow>}
                {(transfers as any[]).map((t) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ProductFormData = { product_code: string; product_name: string; barcode: string | null; default_unit: string; current_buy_price: number; current_retail_price: number; current_wholesale_price: number; minimum_stock: number; current_stock: number; supplier_id: string | null };

function ProductForm({ editing, suppliers, onSubmit, loading }: { editing: Product | null; suppliers: { id: string; supplier_name: string }[]; onSubmit: (f: ProductFormData) => void; loading: boolean }) {
  const [form, setForm] = useState<ProductFormData>({ product_code: "", product_name: "", barcode: "", default_unit: "PCS", current_buy_price: 0, current_retail_price: 0, current_wholesale_price: 0, minimum_stock: 0, current_stock: 0, supplier_id: null });
  useEffect(() => {
    if (editing) setForm({ product_code: editing.product_code, product_name: editing.product_name, barcode: editing.barcode ?? "", default_unit: editing.default_unit, current_buy_price: editing.current_buy_price, current_retail_price: editing.current_retail_price, current_wholesale_price: editing.current_wholesale_price, minimum_stock: editing.minimum_stock, current_stock: editing.current_stock, supplier_id: editing.supplier_id });
    else setForm({ product_code: "", product_name: "", barcode: "", default_unit: "PCS", current_buy_price: 0, current_retail_price: 0, current_wholesale_price: 0, minimum_stock: 0, current_stock: 0, supplier_id: null });
  }, [editing]);
  const n = (v: string) => Number(v) || 0;
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kode *</Label><Input required value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Barcode</Label><Input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Nama Barang *</Label><Input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Satuan</Label><Input value={form.default_unit} onChange={(e) => setForm({ ...form, default_unit: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Min Stok</Label><Input type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: n(e.target.value) })} /></div>
          {editing && <div className="space-y-1.5 col-span-2"><Label>Stok Sistem</Label><Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: n(e.target.value) })} /></div>}
          <div className="space-y-1.5"><Label>Harga Beli</Label><Input type="number" value={form.current_buy_price} onChange={(e) => setForm({ ...form, current_buy_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Harga Retail</Label><Input type="number" value={form.current_retail_price} onChange={(e) => setForm({ ...form, current_retail_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Harga Grosir</Label><Input type="number" value={form.current_wholesale_price} onChange={(e) => setForm({ ...form, current_wholesale_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Supplier</Label>
            <Select value={form.supplier_id ?? "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
              <SelectContent><SelectItem value="none">- Tanpa Supplier -</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
