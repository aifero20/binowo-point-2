import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerSheetsSync } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, ShoppingCart, PauseCircle, PlayCircle, XCircle, Printer, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useRequireShift } from "@/hooks/use-require-shift";
import { isOnline, saveOfflineSale, syncPendingSales } from "@/lib/offline-sync";
import { db } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/sales")({ component: SalesPOS });

type CartLine = { product_id: string; product_name: string; unit_name: string; qty: number; selling_price: number; buy_price?: number; discount?: number; discountType?: "per_pcs" | "per_total"; overStock?: boolean };

function SalesPOS() {
  const { user } = useAuth();
  const { needsShift, isLoading: shiftLoading, hasOpenShift } = useRequireShift();
  const qc = useQueryClient();
  if (needsShift && shiftLoading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Memeriksa shift...</p></div>;
  if (needsShift && !hasOpenShift) return null;
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("TUNAI");
  const [voidDialog, setVoidDialog] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(!isOnline());
  const [customerId, setCustomerId] = useState<string>("none");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [activeTab, setActiveTab] = useState("pos");
  const [activeCartIdx, setActiveCartIdx] = useState<number | null>(null);
  const [printData, setPrintData] = useState<{ no: string; items: CartLine[]; total: number; bayar: number; kembali: number; customerName: string; method: string } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); document.querySelector<HTMLInputElement>('[placeholder*="barcode"]')?.focus(); }
      if (e.key === "F12") { e.preventDefault(); if (cart.length > 0 && warehouseId) checkout.mutate(); }
      if (e.key === "Escape") { setCart([]); setPaymentAmount(0); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const onOnline = () => { setOfflineMode(false); syncPendingSales(); };
    const onOffline = () => setOfflineMode(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    syncPendingSales();
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, product_code, product_name, default_unit, barcode, current_buy_price, current_retail_price, current_wholesale_price, product_units(id, unit_name, conversion_qty, retail_price, wholesale_price)").is("deleted_at", null).limit(20);
      if (search) q = q.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: productDiscountMap } = useQuery({
    queryKey: ["product-discounts-all"],
    queryFn: async () => {
      const { data } = await supabase.from("product_discounts").select("product_id, customer_type, discount_pct");
      const map: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((d) => {
        if (!map[d.product_id]) map[d.product_id] = {};
        map[d.product_id][d.customer_type] = d.discount_pct;
      });
      return map;
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-active"],
    queryFn: async () => { const { data } = await supabase.from("warehouses").select("id, warehouse_name").eq("is_active", true); return data ?? []; },
  });

  const { data: stockMap = {} } = useQuery({
    queryKey: ["pos-stock", warehouseId],
    queryFn: async () => {
      if (!warehouseId) return {};
      const { data } = await supabase.from("stock_movements").select("product_id, qty_in, qty_out").eq("warehouse_id", warehouseId);
      const map: Record<string, number> = {};
      for (const m of (data ?? []) as any[]) {
        if (!map[m.product_id]) map[m.product_id] = 0;
        map[m.product_id] += Number(m.qty_in) - Number(m.qty_out);
      }
      return map;
    },
    enabled: !!warehouseId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => { const { data } = await supabase.from("customers").select("id, customer_name, customer_type").is("deleted_at", null).order("customer_name").limit(100); return data ?? []; },
  });

  const { data: heldTransactions = [] } = useQuery({
    queryKey: ["held-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_headers").select("id, sales_number, grand_total, created_at, customers(customer_name), sales_details(qty, unit_name, products(product_name))").eq("transaction_status", "HOLD").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyFilterCustomer, setHistoryFilterCustomer] = useState("");
  const [historyFilterKasir, setHistoryFilterKasir] = useState("");
  const [historyFilterMethod, setHistoryFilterMethod] = useState("ALL");
  const [showHistoryFilter, setShowHistoryFilter] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  const { data: recentSales = [], refetch: refetchRecentSales } = useQuery({
    queryKey: ["recent-sales", historyFrom, historyTo],
    queryFn: async () => {
      let q = supabase.from("sales_headers").select("id, sales_number, grand_total, transaction_status, payment_method, created_at, cashier_id, customers(customer_name), sales_details(qty, unit_name, selling_price, products(product_name))").neq("transaction_status", "HOLD").order("created_at", { ascending: false }).limit(500);
      if (historyFrom) q = q.gte("created_at", historyFrom + "T00:00:00");
      if (historyTo) q = q.lte("created_at", historyTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      const sales = data ?? [];
      if (sales.length === 0) return [];
      const cashierIds = [...new Set(sales.map((s: any) => s.cashier_id).filter(Boolean))];
      const { data: kasirData } = await supabase.from("users").select("id, full_name").in("id", cashierIds);
      const kasirMap: Record<string, string> = {};
      (kasirData ?? []).forEach((u: any) => { kasirMap[u.id] = u.full_name; });
      return sales.map((s: any) => ({ ...s, kasir_name: kasirMap[s.cashier_id] ?? "-" }));
    },
    staleTime: 0,
  });

  const filteredSales = recentSales.filter((s: any) => {
    const cust = s.customers?.customer_name ?? "";
    const kasir = s.kasir_name ?? "";
    if (historyFilterCustomer && !cust.toLowerCase().includes(historyFilterCustomer.toLowerCase())) return false;
    if (historyFilterKasir && !kasir.toLowerCase().includes(historyFilterKasir.toLowerCase())) return false;
    if (historyFilterMethod !== "ALL" && s.payment_method !== historyFilterMethod) return false;
    return true;
  });
  const historyTotalPages = Math.max(1, Math.ceil(filteredSales.length / HISTORY_PAGE_SIZE));
  const pagedSales = filteredSales.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
  const isHistoryFiltered = historyFrom || historyTo || historyFilterCustomer || historyFilterKasir || historyFilterMethod !== "ALL";

  const selectedCustomerType = useMemo(() => {
    if (customerId === "none") return "RETAIL";
    return (customers.find((c) => c.id === customerId) as Record<string, unknown>)?.customer_type as string ?? "RETAIL";
  }, [customerId, customers]);

  useEffect(() => {
    setCart((c) => c.map((item) => {
      const discPct = productDiscountMap?.[item.product_id]?.[selectedCustomerType] ?? 0;
      const prod = (products as any[]).find((p) => p.id === item.product_id);
      const newPrice = prod ? (selectedCustomerType === "GROSIR" ? Number(prod.current_wholesale_price ?? prod.current_retail_price) : Number(prod.current_retail_price)) : item.selling_price;
      return { ...item, discount: discPct, selling_price: newPrice };
    }));
  }, [selectedCustomerType, productDiscountMap]);

  const subtotalBeforeDiscount = useMemo(() => cart.reduce((s, l) => {
    const gross = l.qty * l.selling_price;
    const disc = l.discount ?? 0;
    if (!disc) return s + gross;
    if ((l.discountType ?? "per_pcs") === "per_pcs") {
      return s + l.qty * l.selling_price * (1 - disc / 100);
    } else {
      return s + gross * (1 - disc / 100);
    }
  }, 0), [cart]);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const utama = warehouses.find((w) => w.warehouse_name.toLowerCase().includes("utama")) ?? warehouses[0];
      setWarehouseId(utama.id);
    }
  }, [warehouses]);

  const subtotal = useMemo(() => subtotalBeforeDiscount * (1 - headerDiscount / 100), [subtotalBeforeDiscount, headerDiscount]);
  const change = paymentAmount - subtotal;

  function addToCart(p: { id: string; product_name: string; default_unit: string; current_buy_price?: number; current_retail_price: number; current_wholesale_price?: number }, unitName?: string, price?: number, conv?: number) {
    const unit = unitName ?? p.default_unit;
    const sp = price ?? (selectedCustomerType === "GROSIR" ? Number(p.current_wholesale_price ?? p.current_retail_price) : Number(p.current_retail_price));
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id && l.unit_name === unit);
      if (existing) { setActiveCartIdx(prev.indexOf(existing)); return prev.map((l) => l.product_id === p.id && l.unit_name === unit ? { ...l, qty: l.qty + 1 } : l); }
      setActiveCartIdx(prev.length);
      return [...prev, { product_id: p.id, product_name: p.product_name, unit_name: unit, qty: 1, selling_price: sp, buy_price: Number((p as any).current_buy_price ?? 0) }];
    });
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (!warehouseId) throw new Error("Pilih gudang");
      if (paymentMethod === "TUNAI" && paymentAmount < subtotal) throw new Error("Pembayaran kurang");
      if (cart.some((l) => l.overStock)) throw new Error("Ada item melebihi stok tersedia");
      // Validasi stok realtime sebelum transaksi
      const { data: freshMovements } = await supabase
        .from("stock_movements")
        .select("product_id, qty_in, qty_out")
        .eq("warehouse_id", warehouseId)
        .in("product_id", cart.map((l) => l.product_id));
      const freshStock: Record<string, number> = {};
      for (const m of (freshMovements ?? []) as any[]) {
        if (!freshStock[m.product_id]) freshStock[m.product_id] = 0;
        freshStock[m.product_id] += Number(m.qty_in) - Number(m.qty_out);
      }
      const overStockItems = cart.filter((l) => {
        const avail = freshStock[l.product_id] ?? 0;
        return l.qty > avail;
      });
      if (overStockItems.length > 0) {
        const names = overStockItems.map((l) => `${l.product_name} (stok: ${freshStock[l.product_id] ?? 0})`).join(", ");
        throw new Error(`Stok tidak cukup: ${names}`);
      }
      const { data: numberResult, error: numErr } = await supabase.rpc("get_next_receipt_number", { p_doc_type: "sales", p_prefix: "BW" } as never);
      if (numErr) throw numErr;
      const sales_number = numberResult as unknown as string;
      const grossTotal = cart.reduce((s, l) => s + l.qty * l.selling_price, 0);
      const { data: header, error: he } = await supabase.from("sales_headers").insert({ sales_number, transaction_date: new Date().toISOString(), customer_id: customerId === "none" ? null : customerId, cashier_id: user!.id, subtotal: grossTotal, grand_total: subtotal, discount: grossTotal - subtotal, payment_amount: paymentAmount, change_amount: change, payment_method: paymentMethod, transaction_status: "SELESAI", hold_status: false } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      await supabase.from("sales_details").insert(cart.map((l) => ({ sales_id: sid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, selling_price: l.selling_price, buy_price: l.buy_price ?? 0, total: l.qty * l.selling_price })) as never);
      await supabase.from("stock_movements").insert(cart.map((l) => ({ product_id: l.product_id, warehouse_id: warehouseId, transaction_type: "sale", reference_number: sales_number, qty_out: l.qty, created_by: user!.id })) as never);
      const custName = customers.find((c) => c.id === customerId)?.customer_name ?? "Umum / Walk-in";
      return { no: sales_number, items: [...cart], total: subtotal, bayar: paymentAmount, kembali: change, customerName: custName, method: paymentMethod };
    },
    onSuccess: (data) => {
      toast.success(`Transaksi ${data.no} berhasil`);
      triggerSheetsSync("sales");
      setPrintData(data);
      setCart([]);
      setPaymentAmount(0);
      setCustomerId("none");
      setHeaderDiscount(0);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const holdTransaction = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (!warehouseId) throw new Error("Pilih gudang");
      const sales_number = "HOLD" + Date.now();
      const { data: header, error: he } = await supabase.from("sales_headers").insert({ sales_number, transaction_date: new Date().toISOString(), cashier_id: user!.id, subtotal, grand_total: subtotal, payment_method: paymentMethod, transaction_status: "HOLD", hold_status: true } as never).select("id").single();
      if (he) throw he;
      const sid = (header as { id: string }).id;
      await supabase.from("sales_details").insert(cart.map((l) => ({ sales_id: sid, product_id: l.product_id, warehouse_id: warehouseId, qty: l.qty, unit_name: l.unit_name, selling_price: l.selling_price, buy_price: l.buy_price ?? 0, total: l.qty * l.selling_price })) as never);
    },
    onSuccess: () => { toast.success("Transaksi di-hold"); setCart([]); setPaymentAmount(0); qc.invalidateQueries({ queryKey: ["held-sales"] }); qc.invalidateQueries({ queryKey: ["recent-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeHold = useMutation({
    mutationFn: async (id: string) => {
      const { data: details } = await supabase.from("sales_details").select("product_id, qty, unit_name, selling_price, products(product_name)").eq("sales_id", id);
      const { error } = await supabase.from("sales_headers").update({ hold_status: false, deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
      return (details ?? []).map((d: any) => ({ product_id: d.product_id, product_name: d.products?.product_name ?? "-", unit_name: d.unit_name, qty: Number(d.qty), selling_price: Number(d.selling_price) }));
    },
    onSuccess: (items) => { setCart(items); setActiveTab("pos"); toast.success("Transaksi dilanjutkan"); qc.invalidateQueries({ queryKey: ["held-sales"] }); qc.invalidateQueries({ queryKey: ["recent-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_headers").update({ transaction_status: "VOID" } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transaksi di-void"); setVoidDialog(null); qc.invalidateQueries(); triggerSheetsSync("sales"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "history") refetchRecentSales(); }}>
        <TabsList><TabsTrigger value="pos">POS Kasir</TabsTrigger><TabsTrigger value="held">Hold ({heldTransactions.length})</TabsTrigger><TabsTrigger value="history">Riwayat</TabsTrigger></TabsList>

        <TabsContent value="pos">
          <div className="grid gap-4 lg:grid-cols-[1fr_400px] items-stretch">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Cari Barang</CardTitle>
                <Input
                  autoFocus
                  placeholder="Scan barcode / cari nama barang... (F2)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const code = search.trim().toLowerCase();
                    if (!code) return;
                    const match = (products as any[]).find((p) => (p.barcode ?? "").toLowerCase() === code);
                    if (match) {
                      addToCart(match, match.default_unit, selectedCustomerType === "GROSIR" ? Number(match.current_wholesale_price ?? match.current_retail_price) : Number(match.current_retail_price), 1);
                      toast.success(`${match.product_name} ditambahkan`);
                      setSearch("");
                    } else {
                      toast.error("Barcode tidak ditemukan di Master Barang");
                    }
                  }}
                  className="h-12 text-base"
                />
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  <Table>
                    <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
                    <TableBody>
                      {products.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Ketik untuk cari barang...</TableCell></TableRow>}
                      {products.map((p) => (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => addToCart(p, p.default_unit, selectedCustomerType === "GROSIR" ? Number(p.current_wholesale_price ?? p.current_retail_price) : Number(p.current_retail_price), 1)}>
                          <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                          <TableCell className="font-medium">{p.product_name}</TableCell>
                          <TableCell className="text-right">{formatRp(selectedCustomerType === "GROSIR" ? (p.current_wholesale_price ?? p.current_retail_price) : p.current_retail_price)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); addToCart(p, p.default_unit, selectedCustomerType === "GROSIR" ? Number(p.current_wholesale_price ?? p.current_retail_price) : Number(p.current_retail_price), 1); }}>+ {p.default_unit}</Button>
                              {(p.product_units as { id: string; unit_name: string; conversion_qty: number; retail_price: number; wholesale_price?: number }[] ?? []).map((u) => (
                                <Button key={u.id} size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addToCart(p, u.unit_name, selectedCustomerType === "GROSIR" ? Number(u.wholesale_price ?? u.retail_price) : Number(u.retail_price), Number(u.conversion_qty)); }}>+ {u.unit_name}</Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader><CardTitle className="flex items-center justify-between">Keranjang{offlineMode && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-normal">OFFLINE</span>}</CardTitle></CardHeader>
              <CardContent className="space-y-3 flex-1 overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <div className="relative">
                      <input type="text" className="w-full h-9 border rounded-md px-3 text-sm bg-background" placeholder="Umum / Walk-in" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true); }} onFocus={() => setCustomerOpen(true)} onBlur={() => setTimeout(() => setCustomerOpen(false), 150)} />
                      {customerOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-md max-h-[180px] overflow-y-auto">
                          <div className="px-3 py-2 text-sm cursor-pointer hover:bg-accent" onMouseDown={() => { setCustomerId("none"); setCustomerSearch(""); setCustomerOpen(false); }}>Umum / Walk-in</div>
                          {customers.filter((c) => c.customer_name.toLowerCase().includes(customerSearch.toLowerCase())).map((c) => (
                            <div key={c.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent" onMouseDown={() => { setCustomerId(c.id); setCustomerSearch(c.customer_name); setCustomerOpen(false); }}>{c.customer_name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Diskon Header (%)</Label>
                    <Input type="number" min={0} max={100} value={headerDiscount} onChange={(e) => setHeaderDiscount(Number(e.target.value))} placeholder="0" />
                  </div>
                </div>
                <div className="border rounded-md divide-y max-h-[150px] overflow-y-auto">
                  {cart.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Keranjang kosong</p>}
                  {cart.map((l, i) => (
                    <div key={i} className="p-2 flex gap-2 items-start text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{l.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRp(l.selling_price)} x {l.qty}
                          <span className="font-medium text-foreground"> = {formatRp(l.qty * l.selling_price * (1 - (l.discount ?? 0) / 100))}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <Input type="number" min={1} value={l.qty} onChange={(e) => { const newQty = Number(e.target.value) || 1; const avail = (stockMap as any)[l.product_id] ?? 0; setCart((c) => c.map((x, j) => j === i ? { ...x, qty: newQty, overStock: newQty > avail && avail >= 0 } : x)); }} onFocus={(e) => e.target.select()} autoFocus={activeCartIdx === i} className={`w-16 h-8 ${l.overStock ? "border-red-500 focus-visible:ring-red-500" : ""}`} />
                        {l.overStock && <span className="text-red-500 text-xs whitespace-nowrap">Stok: {(stockMap as any)[l.product_id] ?? 0}</span>}
                      </div>
                      <Input type="number" min={0} max={100} value={l.discount ?? 0} onChange={(e) => setCart((c) => c.map((x, j) => j === i ? { ...x, discount: Number(e.target.value) } : x))} className="w-14 h-8" placeholder="%" title="Diskon %" />
                      <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                {cart.some((l) => l.overStock) && (
                  <p className="text-xs text-red-500 font-medium">Ada item melebihi stok tersedia. Kurangi jumlah sebelum bayar.</p>
                )}
                {headerDiscount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span><span>{formatRp(subtotalBeforeDiscount)}</span>
                  </div>
                )}
                {headerDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Diskon {headerDiscount}%</span><span>-{formatRp(subtotalBeforeDiscount - subtotal)}</span>
                  </div>
                )}
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
                  <Button size="lg" disabled={checkout.isPending || cart.length === 0 || cart.some((l) => l.overStock)} onClick={() => checkout.mutate()}>
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
              <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
              <TableBody>
                {heldTransactions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada transaksi hold.</TableCell></TableRow>}
                {heldTransactions.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.sales_number}</TableCell>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-sm">{(h as any).customers?.customer_name ?? <span className="text-muted-foreground text-xs">Umum</span>}</TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {((h as any).sales_details ?? []).slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="truncate">{d.products?.product_name} <span className="text-muted-foreground">x{d.qty}</span></div>
                      ))}
                      {((h as any).sales_details ?? []).length > 3 && <div className="text-muted-foreground">+{((h as any).sales_details ?? []).length - 3} lainnya</div>}
                    </TableCell>
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
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant={isHistoryFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowHistoryFilter((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />Filter{isHistoryFiltered ? " (aktif)" : ""}
              </Button>
            </div>
            {showHistoryFilter && (
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Dari Tanggal</Label><Input type="date" value={historyFrom} onChange={(e) => { setHistoryFrom(e.target.value); setHistoryPage(1); }} /></div>
                    <div className="space-y-1.5"><Label>Sampai Tanggal</Label><Input type="date" value={historyTo} onChange={(e) => { setHistoryTo(e.target.value); setHistoryPage(1); }} /></div>
                    <div className="space-y-1.5"><Label>Nama Customer</Label><Input placeholder="Cari customer..." value={historyFilterCustomer} onChange={(e) => { setHistoryFilterCustomer(e.target.value); setHistoryPage(1); }} /></div>
                    <div className="space-y-1.5"><Label>Nama Kasir</Label><Input placeholder="Cari kasir..." value={historyFilterKasir} onChange={(e) => { setHistoryFilterKasir(e.target.value); setHistoryPage(1); }} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Metode Pembayaran</Label>
                      <Select value={historyFilterMethod} onValueChange={(v) => { setHistoryFilterMethod(v); setHistoryPage(1); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Semua Metode</SelectItem>
                          <SelectItem value="TUNAI">Tunai</SelectItem>
                          <SelectItem value="TRANSFER">Transfer</SelectItem>
                          <SelectItem value="QRIS">QRIS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {isHistoryFiltered && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => { setHistoryFrom(""); setHistoryTo(""); setHistoryFilterCustomer(""); setHistoryFilterKasir(""); setHistoryFilterMethod("ALL"); setHistoryPage(1); }}>Reset Filter</Button>}
                </CardContent>
              </Card>
            )}
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>No. Transaksi</TableHead><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Kasir</TableHead><TableHead>Metode</TableHead><TableHead>Ringkasan Produk</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                <TableBody>
                  {pagedSales.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Belum ada transaksi.</TableCell></TableRow>}
                  {pagedSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.sales_number}</TableCell>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-xs">{(s as any).customers?.customer_name ?? <span className="text-muted-foreground">Umum</span>}</TableCell>
                      <TableCell className="text-xs">{(s as any).kasir_name ?? "-"}</TableCell>
                      <TableCell className="text-xs">{s.payment_method}</TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {((s as any).sales_details ?? []).slice(0, 3).map((d: any, i: number) => (
                          <div key={i} className="truncate">{d.products?.product_name} <span className="text-muted-foreground">x{d.qty} {d.unit_name} @ {formatRp(d.selling_price)}</span></div>
                        ))}
                        {((s as any).sales_details ?? []).length > 3 && <div className="text-muted-foreground">+{((s as any).sales_details ?? []).length - 3} lainnya</div>}
                      </TableCell>
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
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                  <span>Halaman {historyPage} dari {historyTotalPages} ({filteredSales.length} data)</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

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

      {printData && (
        <Dialog open={!!printData} onOpenChange={() => setPrintData(null)}>
          <DialogContent className="max-w-xs">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #print-area, #print-area * { visibility: visible; }
                #print-area { position: absolute; left: 0; top: 0; width: 80mm; padding: 4mm; }
                @page { size: 80mm auto; margin: 0; }
              }
            `}</style>
            <DialogHeader><DialogTitle className="text-center">Struk Pembayaran</DialogTitle></DialogHeader>
            <div id="print-area" className="font-mono text-xs space-y-1 border rounded p-3">
              <p className="text-center font-bold text-sm">GROSIR ROKOK BINOWO</p>
              <p className="text-center">Binowo, Balarejo, Kebonsari</p>
              <p className="text-center">Telp / WA : 0813 3113 1048</p>
              <div className="border-t border-dashed my-2" />
              <p className="text-center text-muted-foreground">{new Date().toLocaleString("id-ID")}</p>
              <div className="flex justify-between"><span>{printData.no}</span><span>{printData.customerName}</span></div>
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
              <div className="flex justify-between"><span>Bayar ({printData.method})</span><span>{formatRp(printData.bayar)}</span></div>
              <div className="flex justify-between"><span>Kembali</span><span>{formatRp(printData.kembali)}</span></div>
              <div className="border-t border-dashed my-2" />
              <p className="text-center">Harga Sudah Termasuk PPN</p>
              <p className="text-center">Barang yg dibeli tdk dpt dikembalikan</p>
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
