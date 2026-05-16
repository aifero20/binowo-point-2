import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/activity-logs")({ component: ActivityLogsPage });

type Log = { id: string; activity_time: string; activity_type: string; table_name: string | null; description: string | null; user_id: string | null };

function ActivityLogsPage() {
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["activity-logs", search],
    queryFn: async () => {
      let q = supabase.from("activity_logs").select("id, activity_time, activity_type, table_name, description, user_id").order("activity_time", { ascending: false }).limit(100);
      if (search) q = q.or(`activity_type.ilike.%${search}%,description.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Log[];
    },
  });

  const typeColor: Record<string, "default" | "secondary" | "destructive"> = {
    LOGIN: "default", LOGOUT: "secondary", CREATE: "default", UPDATE: "secondary", DELETE: "destructive", VOID: "destructive"
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Cari aktivitas..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Tipe</TableHead><TableHead>Tabel</TableHead><TableHead>Deskripsi</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada log.</TableCell></TableRow>}
            {data.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.activity_time).toLocaleString("id-ID")}</TableCell>
                <TableCell><Badge variant={typeColor[l.activity_type] ?? "secondary"} className="text-xs">{l.activity_type}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.table_name ?? "-"}</TableCell>
                <TableCell className="text-sm">{l.description ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
