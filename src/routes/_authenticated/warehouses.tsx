import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouses")({ component: WarehousesPage });

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string; is_active: boolean };

function WarehousesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("warehouse_name");
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const save = useMutation({
    mutationFn: async (form: Partial<Warehouse>) => {
      const op = editing ? supabase.from("warehouses").update(form).eq("id", editing.id) : supabase.from("warehouses").insert(form as never);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gudang disimpan"); qc.invalidateQueries({ queryKey: ["warehouses"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" /> Tambah Gudang</Button></DialogTrigger>
          <WarehouseForm editing={editing} onSubmit={(f) => save.mutate(f)} loading={save.isPending} />
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada gudang.</TableCell></TableRow>}
            {data.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-xs">{w.warehouse_code}</TableCell>
                <TableCell className="font-medium">{w.warehouse_name}</TableCell>
                <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => { setEditing(w); setOpen(true); }}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function WarehouseForm({ editing, onSubmit, loading }: { editing: Warehouse | null; onSubmit: (f: Partial<Warehouse>) => void; loading: boolean }) {
  const [form, setForm] = useState<Partial<Warehouse>>(editing ?? { warehouse_code: "", warehouse_name: "", is_active: true });
  React.useEffect(() => { setForm(editing ?? {}); }, [editing]);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit Gudang" : "Tambah Gudang"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div className="space-y-1.5"><Label>Kode *</Label><Input required value={form.warehouse_code ?? ""} onChange={(e) => setForm({ ...form, warehouse_code: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Nama *</Label><Input required value={form.warehouse_name ?? ""} onChange={(e) => setForm({ ...form, warehouse_name: e.target.value })} /></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
