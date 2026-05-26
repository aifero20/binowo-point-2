import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/stock")({ component: StockPage });

type Movement = { id: string; movement_date: string; transaction_type: string; reference_number: string; qty_in: number; qty_out: number; balance_after: number | null; products: { product_name: string; product_code: string } | null; warehouses: { warehouse_name: string } | null };

function StockPage() {
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [searchProduct, setSearchProduct] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["stock-movements", search, productFilter],
    queryFn: async () => {
      let q = supabase.from("stock_movements").select("id, movement_date, transaction_type, reference_number, qty_in, qty_out, balance_after, products(product_name, product_code), warehouses(warehouse_name)").order("movement_date", { ascending: false }).limit(100);
      if (search) q = q.or(`reference_number.ilike.%${search}%`);
      if (productFilter) q = q.eq("product_id", productFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as Movement[];
    },
  });

  const typeLabel: Record<string, string> = {
    purchase: "purchase",
    sale: "sale",
    adjustment: "adjustment",
    transfer_in: "transfer_in",
    transfer_out: "transfer_out",
    sales_return: "sales_return",
    return_out: "purchase_return",
  };

  const typeClass: Record<string, string> = {
    purchase: "bg-blue-100 text-blue-700 border border-blue-200",
    sale: "bg-red-100 text-red-700 border border-red-200",
    adjustment: "bg-gray-100 text-gray-600 border border-gray-200",
    transfer_in: "bg-green-100 text-green-700 border border-green-200",
    transfer_out: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    sales_return: "bg-red-50 text-red-400 border border-red-200",
    return_out: "bg-blue-50 text-blue-400 border border-blue-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Cari no. referensi..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Input placeholder="Filter product ID..." value={searchProduct} onChange={(e) => { setSearchProduct(e.target.value); setProductFilter(e.target.value); }} className="max-w-xs" />
        {productFilter && <button className="text-xs text-muted-foreground underline" onClick={() => { setProductFilter(""); setSearchProduct(""); }}>Reset filter</button>}
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Tipe</TableHead><TableHead>Referensi</TableHead><TableHead>Barang</TableHead><TableHead>Gudang</TableHead><TableHead className="text-right">Masuk</TableHead><TableHead className="text-right">Keluar</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada data.</TableCell></TableRow>}
            {data.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs">{new Date(m.movement_date).toLocaleDateString("id-ID")}</TableCell>
                <TableCell><span className={["text-xs px-2 py-1 rounded-full font-medium", typeClass[m.transaction_type] ?? "bg-gray-100 text-gray-600"].join(" ")}>{typeLabel[m.transaction_type] ?? m.transaction_type}</span></TableCell>
                <TableCell className="font-mono text-xs">{m.reference_number}</TableCell>
                <TableCell className="text-sm">{m.products?.product_name ?? "-"}<span className="text-muted-foreground text-xs ml-1">({m.products?.product_code})</span></TableCell>
                <TableCell className="text-xs">{m.warehouses?.warehouse_name ?? "-"}</TableCell>
                <TableCell className="text-right text-green-600 font-medium">{m.qty_in > 0 ? `+${m.qty_in}` : "-"}</TableCell>
                <TableCell className="text-right text-red-500 font-medium">{m.qty_out > 0 ? `-${m.qty_out}` : "-"}</TableCell>
                <TableCell className="text-right font-bold">{m.balance_after ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
