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
import { Plus, Pencil, Trash2, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

type Supplier = { id: string; supplier_code: string; supplier_name: string; phone: string | null; city: string | null; supplier_type: string | null };

const PAGE_SIZE = 10;

function SuppliersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterCode, setFilterCode] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [page, setPage] = useState(1);

  const { data: allData = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").is("deleted_at", null).order("supplier_name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const filtered = allData.filter((s) => {
    if (filterCode && !s.supplier_code.toLowerCase().includes(filterCode.toLowerCase())) return false;
    if (filterName && !s.supplier_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType && !(s.supplier_type ?? "").toLowerCase().includes(filterType.toLowerCase())) return false;
    if (filterCity && !(s.city ?? "").toLowerCase().includes(filterCity.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const data = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFiltered = filterCode || filterName || filterType || filterCity;

  function resetFilter() { setFilterCode(""); setFilterName(""); setFilterType(""); setFilterCity(""); setPage(1); }

  const save = useMutation({
    mutationFn: async (form: Partial<Supplier>) => {
      const op = editing ? supabase.from("suppliers").update(form).eq("id", editing.id) : supabase.from("suppliers").insert(form as never);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supplier disimpan"); qc.invalidateQueries({ queryKey: ["suppliers"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supplier dihapus"); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} supplier{isFiltered ? " (difilter)" : ""}</p>
        <div className="flex gap-2">
          <Button variant={isFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowFilter((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Filter{isFiltered ? " (aktif)" : ""}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Tambah Supplier</Button></DialogTrigger>
            <SupplierForm editing={editing} onSubmit={(f) => save.mutate(f)} loading={save.isPending} />
          </Dialog>
        </div>
      </div>

      {showFilter && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Kode</Label><Input placeholder="Cari kode..." value={filterCode} onChange={(e) => { setFilterCode(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Nama</Label><Input placeholder="Cari nama..." value={filterName} onChange={(e) => { setFilterName(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Tipe</Label><Input placeholder="Cari tipe..." value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1.5"><Label>Kota</Label><Input placeholder="Cari kota..." value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setPage(1); }} /></div>
            </div>
            {isFiltered && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={resetFilter}>Reset Filter</Button>}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Kota</TableHead><TableHead>Telepon</TableHead><TableHead>Tipe</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada supplier.</TableCell></TableRow>}
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.supplier_code}</TableCell>
                <TableCell className="font-medium">{s.supplier_name}</TableCell>
                <TableCell>{s.city ?? "-"}</TableCell>
                <TableCell>{s.phone ?? "-"}</TableCell>
                <TableCell>{s.supplier_type ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus supplier?")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
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

function SupplierForm({ editing, onSubmit, loading }: { editing: Supplier | null; onSubmit: (f: Partial<Supplier>) => void; loading: boolean }) {
  const [form, setForm] = useState<Partial<Supplier>>(editing ?? { supplier_code: "", supplier_name: "", city: "", phone: "", supplier_type: "ROKOK" });
  useEffect(() => { setForm(editing ?? { supplier_code: "", supplier_name: "", city: "", phone: "", supplier_type: "ROKOK" }); }, [editing]);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kode *</Label><Input required value={form.supplier_code ?? ""} onChange={(e) => setForm({ ...form, supplier_code: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nama *</Label><Input required value={form.supplier_name ?? ""} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Kota</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Telepon</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Tipe</Label><Input value={form.supplier_type ?? ""} onChange={(e) => setForm({ ...form, supplier_type: e.target.value })} /></div>
        </div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
