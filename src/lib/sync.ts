import { offlineDb } from "./offline-db";
import { supabase } from "@/integrations/supabase/client";

export async function syncOfflineSales(userId: string): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDb.sales.where("synced").equals(0).toArray();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const subtotal = sale.items.reduce((s, i) => s + i.qty * i.selling_price, 0);
      const sales_number = "SO-OFF-" + sale.tempId;

      const { data: header, error: he } = await supabase
        .from("sales_headers")
        .insert({
          sales_number,
          cashier_id: userId,
          subtotal,
          grand_total: subtotal,
          payment_amount: sale.paymentAmount,
          change_amount: sale.paymentAmount - subtotal,
          payment_method: sale.paymentMethod,
          transaction_status: "SELESAI",
          hold_status: false,
          transaction_date: sale.createdAt,
        } as never)
        .select("id")
        .single();

      if (he) throw he;
      const sid = (header as { id: string }).id;

      await supabase.from("sales_details").insert(
        sale.items.map((i) => ({
          sales_id: sid,
          product_id: i.product_id,
          warehouse_id: sale.warehouseId,
          qty: i.qty,
          unit_name: i.unit_name,
          selling_price: i.selling_price,
          total: i.qty * i.selling_price,
        })) as never
      );

      await supabase.from("stock_movements").insert(
        sale.items.map((i) => ({
          product_id: i.product_id,
          warehouse_id: sale.warehouseId,
          transaction_type: "sale",
          reference_number: sales_number,
          qty_out: i.qty,
          created_by: userId,
        })) as never
      );

      await offlineDb.sales.update(sale.id!, { synced: true });
      synced++;
    } catch (e) {
      await offlineDb.sales.update(sale.id!, { syncError: String(e) });
      failed++;
    }
  }

  return { synced, failed };
}

export async function cacheProducts() {
  try {
    const { data } = await supabase
      .from("products")
      .select("id, product_code, product_name, barcode, default_unit, current_retail_price")
      .is("deleted_at", null)
      .eq("is_active", true)
      .limit(500);

    if (data && data.length > 0) {
      await offlineDb.products.clear();
      await offlineDb.products.bulkPut(
        data.map((p) => ({ ...p, cachedAt: new Date().toISOString() }))
      );
    }
  } catch {
    // offline, skip
  }
}

export async function triggerSheetsSync(type: "sales" | "purchases" | "all" = "all"): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("https://bapgptjffhufykvoxtnq.supabase.co/functions/v1/sync-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type }),
    });
  } catch {
    // silent fail - sync sheet tidak boleh ganggu transaksi utama
  }
}
