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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type Customer = { id: string; customer_code: string; customer_name: string; phone: string | null; city: string | null; customer_type: string };

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      let q = supabase.from("customers").select("*").is("deleted_at", null).order("customer_name");
      if (search) q = q.or(`customer_name.ilike.%${search}%,customer_code.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const save = useMutation({
    mutationFn: async (form: Partial<Customer>) => {
      const op = editing
        ? supabase.from("customers").update(form).eq("id", editing.id)
        : supabase.from("customers").insert(form as never);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Customer disimpan"); qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Customer dihapus"); qc.invalidateQueries({ queryKey: ["customers"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <Input placeholder="Cari customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" /> Tambah Customer</Button></DialogTrigger>
          <CustomerForm editing={editing} onSubmit={(f) => save.mutate(f)} loading={save.isPending} />
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Kota</TableHead><TableHead>Telepon</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada customer.</TableCell></TableRow>}
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.customer_code}</TableCell>
                <TableCell className="font-medium">{c.customer_name}</TableCell>
                <TableCell>{c.city ?? "-"}</TableCell>
                <TableCell>{c.phone ?? "-"}</TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.customer_type === "GROSIR" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{c.customer_type ?? "RETAIL"}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus customer?")) del.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function CustomerForm({ editing, onSubmit, loading }: { editing: Customer | null; onSubmit: (f: Partial<Customer>) => void; loading: boolean }) {
  const [form, setForm] = useState<Partial<Customer>>(editing ?? { customer_code: "", customer_name: "", city: "", phone: "", customer_type: "RETAIL" });
  useEffect(() => { setForm(editing ?? {}); }, [editing]);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Tambah Customer"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kode *</Label><Input required value={form.customer_code ?? ""} onChange={(e) => setForm({ ...form, customer_code: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nama *</Label><Input required value={form.customer_name ?? ""} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Kota</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Telepon</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Tipe Customer</Label><select value={form.customer_type ?? "RETAIL"} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} className="w-full h-9 border rounded-md px-3 text-sm bg-background"><option value="RETAIL">RETAIL</option><option value="GROSIR">GROSIR</option></select></div>
        </div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}