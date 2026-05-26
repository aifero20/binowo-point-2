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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

type User = { id: string; user_code: string; full_name: string; email: string | null; role_code: string; is_admin: boolean; is_active: boolean };

function UsersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [form, setForm] = useState<Partial<User>>({ user_code: "", full_name: "", role_code: "KASIR", is_admin: false, is_active: true });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").is("deleted_at", null).order("full_name");
      if (error) throw error;
      return data as User[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (editing) {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            action: "update",
            userId: editing.id,
            email: createEmail || undefined,
            userData: { user_code: form.user_code, full_name: form.full_name, role_code: form.role_code, is_admin: form.role_code === "OWNER" || form.role_code === "ADMIN", is_active: form.is_active },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal update user");
      } else {
        if (!createEmail || !createPassword) throw new Error("Email dan password wajib diisi");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            action: "create",
            email: createEmail,
            password: createPassword,
            userData: { user_code: form.user_code, full_name: form.full_name, role_code: form.role_code, is_admin: form.role_code === "OWNER" || form.role_code === "ADMIN", is_active: true },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal tambah user");
      }
    },
    onSuccess: () => { toast.success("User disimpan"); qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("users").update({ deleted_at: new Date().toISOString(), is_active: false } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("User dihapus"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() { setForm({ user_code: "", full_name: "", role_code: "KASIR", is_admin: false, is_active: true }); setEditing(null); setCreateEmail(""); setCreatePassword(""); }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-1" />Tambah User</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Kode User *</Label><Input required value={form.user_code ?? ""} onChange={(e) => setForm({ ...form, user_code: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Role</Label>
                  <Select value={form.role_code ?? "KASIR"} onValueChange={(v) => setForm({ ...form, role_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      <SelectItem value="KASIR">Kasir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2"><Label>Nama Lengkap *</Label><Input required value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-1.5 col-span-2"><Label>Email {!editing && "*"}</Label><Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder={editing ? editing.email ?? "" : "email@domain.com"} /></div>
                {!editing && <div className="space-y-1.5 col-span-2"><Label>Password *</Label><Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="Min 6 karakter" /></div>}
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada user.</TableCell></TableRow>}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.user_code}</TableCell>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.email ?? "-"}</TableCell>
                <TableCell><Badge variant="outline">{u.role_code}</Badge></TableCell>
                <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setForm(u); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus user?")) del.mutate(u.id); }}><Trash2 className="h-4 w-4" /></Button>
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
