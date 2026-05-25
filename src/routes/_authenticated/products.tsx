import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package2, Tag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({ component: ProductsPage });

type Product = { id: string; product_code: string; product_name: string; barcode: string | null; default_unit: string; current_buy_price: number; current_retail_price: number; current_wholesale_price: number; minimum_stock: number; supplier_id: string | null };

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("*").is("deleted_at", null).order("product_name").limit(100);
      if (search) q = q.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, supplier_name").is("deleted_at", null).order("supplier_name");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (form: Partial<Product>) => {
      const op = editing ? supabase.from("products").update(form).eq("id", editing.id) : supabase.from("products").insert(form as never);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Barang disimpan"); qc.invalidateQueries({ queryKey: ["products"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [unitDialog, setUnitDialog] = useState<string | null>(null);
  const [discountDialog, setDiscountDialog] = useState<string | null>(null);

  const { data: productDiscounts = [] } = useQuery({
    queryKey: ["product-discounts", discountDialog],
    queryFn: async () => {
      if (!discountDialog) return [];
      const { data } = await supabase.from("product_discounts").select("*").eq("product_id", discountDialog);
      return data ?? [];
    },
    enabled: !!discountDialog,
  });

  const saveDiscount = useMutation({
    mutationFn: async ({ customer_type, discount_pct }: { customer_type: string; discount_pct: number }) => {
      const { error } = await supabase.from("product_discounts").upsert(
        { product_id: discountDialog!, customer_type, discount_pct },
        { onConflict: "product_id,customer_type" }
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Diskon disimpan"); qc.invalidateQueries({ queryKey: ["product-discounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [unitForm, setUnitForm] = useState({ unit_name: "", conversion_qty: 1, retail_price: 0, wholesale_price: 0 });

  const { data: units = [] } = useQuery({
    queryKey: ["product-units", unitDialog],
    queryFn: async () => {
      if (!unitDialog) return [];
      const { data } = await supabase.from("product_units").select("*").eq("product_id", unitDialog);
      return data ?? [];
    },
    enabled: !!unitDialog,
  });

  const saveUnit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_units").insert({ ...unitForm, product_id: unitDialog } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Satuan ditambahkan"); qc.invalidateQueries({ queryKey: ["product-units"] }); setUnitForm({ unit_name: "", conversion_qty: 1, retail_price: 0, wholesale_price: 0 }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Satuan dihapus"); qc.invalidateQueries({ queryKey: ["product-units"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Barang dihapus"); qc.invalidateQueries({ queryKey: ["products"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <Input placeholder="Cari barang / barcode..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" /> Tambah Barang</Button></DialogTrigger>
          <ProductForm editing={editing} suppliers={suppliers} onSubmit={(f) => save.mutate(f)} loading={save.isPending} />
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Satuan</TableHead><TableHead className="text-right">Harga Beli</TableHead><TableHead className="text-right">Harga Retail</TableHead><TableHead className="text-right">Harga Grosir</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada barang.</TableCell></TableRow>}
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                <TableCell className="font-medium">{p.product_name}</TableCell>
                <TableCell>{p.default_unit}</TableCell>
                <TableCell className="text-right">{formatRp(p.current_buy_price)}</TableCell>
                <TableCell className="text-right">{formatRp(p.current_retail_price)}</TableCell>
                <TableCell className="text-right">{formatRp(p.current_wholesale_price)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Satuan" onClick={() => setUnitDialog(p.id)}><Package2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Diskon" onClick={() => setDiscountDialog(p.id)}><Tag className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus barang?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      {/* Unit Dialog */}
      <Dialog open={!!unitDialog} onOpenChange={(o) => { if (!o) setUnitDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Multi Satuan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1"><Label className="text-xs">Satuan</Label><Input placeholder="DUS" value={unitForm.unit_name} onChange={(e) => setUnitForm({ ...unitForm, unit_name: e.target.value })} className="h-8" /></div>
              <div className="space-y-1"><Label className="text-xs">Konversi</Label><Input type="number" value={unitForm.conversion_qty} onChange={(e) => setUnitForm({ ...unitForm, conversion_qty: Number(e.target.value) })} className="h-8" /></div>
              <div className="space-y-1"><Label className="text-xs">Harga Retail</Label><Input type="number" value={unitForm.retail_price} onChange={(e) => setUnitForm({ ...unitForm, retail_price: Number(e.target.value) })} className="h-8" /></div>
              <div className="space-y-1"><Label className="text-xs">Harga Grosir</Label><Input type="number" value={unitForm.wholesale_price} onChange={(e) => setUnitForm({ ...unitForm, wholesale_price: Number(e.target.value) })} className="h-8" /></div>
            </div>
            <Button size="sm" onClick={() => saveUnit.mutate()} disabled={!unitForm.unit_name || saveUnit.isPending}>+ Tambah Satuan</Button>
            <Table>
              <TableHeader><TableRow><TableHead>Satuan</TableHead><TableHead>Konversi</TableHead><TableHead>Retail</TableHead><TableHead>Grosir</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {units.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">Belum ada satuan tambahan.</TableCell></TableRow>}
                {units.map((u: { id: string; unit_name: string; conversion_qty: number; retail_price: number; wholesale_price: number }) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.unit_name}</TableCell>
                    <TableCell>{u.conversion_qty}x</TableCell>
                    <TableCell>{u.retail_price?.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{u.wholesale_price?.toLocaleString("id-ID")}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => delUnit.mutate(u.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    {/* Dialog Diskon */}
    <Dialog open={!!discountDialog} onOpenChange={(o) => !o && setDiscountDialog(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Kelola Diskon Per Tipe Customer</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {["RETAIL", "GROSIR"].map((type) => {
            const existing = productDiscounts.find((d: Record<string, unknown>) => d.customer_type === type);
            const [val, setVal] = React.useState(existing ? String(existing.discount_pct) : "0");
            React.useEffect(() => { setVal(existing ? String(existing.discount_pct) : "0"); }, [existing]);
            return (
              <div key={type} className="flex items-center gap-3">
                <span className={`text-sm font-medium w-16 px-2 py-1 rounded-full text-center ${type === "GROSIR" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{type}</span>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="number" min={0} max={100} value={val} onChange={(e) => setVal(e.target.value)} className="w-24 h-8" placeholder="0" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <Button size="sm" onClick={() => saveDiscount.mutate({ customer_type: type, discount_pct: Number(val) })} disabled={saveDiscount.isPending}>Simpan</Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}

function ProductForm({ editing, suppliers, onSubmit, loading }: { editing: Product | null; suppliers: { id: string; supplier_name: string }[]; onSubmit: (f: Partial<Product>) => void; loading: boolean }) {
  const [form, setForm] = useState<Partial<Product>>(editing ?? { product_code: "", product_name: "", barcode: "", default_unit: "PCS", current_buy_price: 0, current_retail_price: 0, current_wholesale_price: 0, minimum_stock: 0, supplier_id: null });
  React.useEffect(() => { setForm(editing ?? {}); }, [editing]);
  const n = (v: string) => Number(v) || 0;
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kode *</Label><Input required value={form.product_code ?? ""} onChange={(e) => setForm({ ...form, product_code: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Barcode</Label><Input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Nama Barang *</Label><Input required value={form.product_name ?? ""} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Satuan Default</Label><Input value={form.default_unit ?? ""} onChange={(e) => setForm({ ...form, default_unit: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Min Stok</Label><Input type="number" value={form.minimum_stock ?? 0} onChange={(e) => setForm({ ...form, minimum_stock: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Harga Beli</Label><Input type="number" value={form.current_buy_price ?? 0} onChange={(e) => setForm({ ...form, current_buy_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Harga Retail</Label><Input type="number" value={form.current_retail_price ?? 0} onChange={(e) => setForm({ ...form, current_retail_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Harga Grosir</Label><Input type="number" value={form.current_wholesale_price ?? 0} onChange={(e) => setForm({ ...form, current_wholesale_price: n(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Supplier</Label>
            <Select value={form.supplier_id ?? ""} onValueChange={(v) => setForm({ ...form, supplier_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

