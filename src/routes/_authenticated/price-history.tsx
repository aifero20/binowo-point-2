import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRp } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/price-history")({ component: PriceHistoryPage });

type PriceHistory = { id: string; change_date: string; old_buy_price: number; new_buy_price: number; old_retail_price: number; new_retail_price: number; old_wholesale_price: number; new_wholesale_price: number; products: { product_name: string; product_code: string } | null };

function PriceHistoryPage() {
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["price-history", search],
    queryFn: async () => {
      let q = supabase.from("price_history").select("id, change_date, old_buy_price, new_buy_price, old_retail_price, new_retail_price, old_wholesale_price, new_wholesale_price, products(product_name, product_code)").order("change_date", { ascending: false }).limit(100);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PriceHistory[];
    },
  });

  const filtered = search ? data.filter((h) => h.products?.product_name?.toLowerCase().includes(search.toLowerCase()) || h.products?.product_code?.toLowerCase().includes(search.toLowerCase())) : data;

  function diff(o: number, n: number) {
    const d = n - o;
    if (d === 0) return null;
    return <span className={d > 0 ? "text-green-600 text-xs" : "text-red-500 text-xs"}>{d > 0 ? "▲" : "▼"}{formatRp(Math.abs(d))}</span>;
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Cari nama / kode barang..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead className="text-right">Harga Beli Lama</TableHead>
              <TableHead className="text-right">Harga Beli Baru</TableHead>
              <TableHead className="text-right">Retail Lama</TableHead>
              <TableHead className="text-right">Retail Baru</TableHead>
              <TableHead className="text-right">Grosir Lama</TableHead>
              <TableHead className="text-right">Grosir Baru</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada riwayat harga.</TableCell></TableRow>}
            {filtered.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="text-xs">{new Date(h.change_date).toLocaleString("id-ID")}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{h.products?.product_name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">{h.products?.product_code}</p>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_buy_price)}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatRp(h.new_buy_price)} {diff(h.old_buy_price, h.new_buy_price)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_retail_price)}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatRp(h.new_retail_price)} {diff(h.old_retail_price, h.new_retail_price)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatRp(h.old_wholesale_price)}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatRp(h.new_wholesale_price)} {diff(h.old_wholesale_price, h.new_wholesale_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
