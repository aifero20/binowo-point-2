import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity-logs")({ component: ActivityLogsPage });

type Log = { id: string; activity_time: string; activity_type: string; table_name: string | null; description: string | null; user_id: string | null; kasir_name?: string };

const PAGE_SIZE = 10;

const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  LOGIN: "default", LOGOUT: "secondary",
  CREATE: "default", UPDATE: "secondary",
  DELETE: "destructive", VOID: "destructive",
};

const ALL_TYPES = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "VOID"];
const ALL_TABLES = ["sales_headers", "purchase_headers", "purchase_returns", "products", "users", "warehouses"];

function ActivityLogsPage() {
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterTable, setFilterTable] = useState("ALL");
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: users = [] } = useQuery({
    queryKey: ["users-list-log"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ["activity-logs", filterType, filterTable, filterUser, filterFrom, filterTo],
    queryFn: async () => {
      // Fetch users map dulu
      const { data: usersData } = await supabase.from("users").select("id, full_name");
      const userMap: Record<string, string> = {};
      (usersData ?? []).forEach((u: any) => { userMap[u.id] = u.full_name; });

      let q = supabase.from("activity_logs")
        .select("id, activity_time, activity_type, table_name, description, user_id")
        .order("activity_time", { ascending: false })
        .limit(500);
      if (filterType !== "ALL") q = q.eq("activity_type", filterType);
      if (filterTable !== "ALL") q = q.eq("table_name", filterTable);
      if (filterUser !== "ALL") q = q.eq("user_id", filterUser);
      if (filterFrom) q = q.gte("activity_time", filterFrom + "T00:00:00");
      if (filterTo) q = q.lte("activity_time", filterTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((l: any) => ({ ...l, _userName: userMap[l.user_id] ?? "-" }));
    },
  });

  const totalPages = Math.max(1, Math.ceil(allLogs.length / PAGE_SIZE));
  const logs = allLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFiltered = filterType !== "ALL" || filterUser !== "ALL" || filterFrom || filterTo;

  function resetFilter() {
    setFilterType("ALL"); setFilterTable("ALL"); setFilterUser("ALL");
    setFilterFrom(""); setFilterTo(""); setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{allLogs.length} log ditemukan</p>
        <Button variant={isFiltered ? "default" : "outline"} className="gap-2" onClick={() => setShowFilter((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" />Filter{isFiltered ? " (aktif)" : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe Aktivitas</Label>
                <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Tipe</SelectItem>
                    {ALL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>User</Label>
                <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setPage(1); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua User</SelectItem>
                    {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dari Tanggal</Label>
                <Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Sampai Tanggal</Label>
                <Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            {isFiltered && <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={resetFilter}>Reset Filter</Button>}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Tipe</TableHead>
<TableHead>Deskripsi</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Memuat...</TableCell></TableRow>}
            {!isLoading && logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada log.</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.activity_time).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-sm font-medium">{(l as any)._userName ?? "-"}</TableCell>
                <TableCell><Badge variant={TYPE_COLORS[l.activity_type] ?? "secondary"} className="text-xs">{l.activity_type}</Badge></TableCell>
<TableCell className="text-sm">{l.description ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>Halaman {page} dari {totalPages} ({allLogs.length} data)</span>
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
