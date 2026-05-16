import { db } from "./db";
import { supabase } from "@/integrations/supabase/client";

export async function cacheProducts() {
  try {
    const { data } = await supabase
      .from("products")
      .select("id, product_code, product_name, barcode, default_unit, current_retail_price, current_wholesale_price")
      .is("deleted_at", null)
      .eq("is_active", true)
      .limit(2000);
    if (!data) return;
    const now = Date.now();
    await db.offlineProducts.bulkPut(data.map((p) => ({ ...p, cachedAt: now })));
  } catch (e) {
    console.error("cacheProducts failed", e);
  }
}

export async function syncPendingSales() {
  const pending = await db.offlineSales.where("synced").equals(0).toArray();
  for (const sale of pending) {
    try {
      const { header, details, movements } = JSON.parse(sale.payload);
      const { data: h, error: he } = await supabase.from("sales_headers").insert(header).select("id").single();
      if (he) throw he;
      const sid = (h as { id: string }).id;
      await supabase.from("sales_details").insert(details.map((d: Record<string, unknown>) => ({ ...d, sales_id: sid })));
      await supabase.from("stock_movements").insert(movements.map((m: Record<string, unknown>) => ({ ...m })));
      await db.offlineSales.update(sale.id!, { synced: 1 });
    } catch (e) {
      console.error("sync failed for", sale.localId, e);
    }
  }
}

export async function saveOfflineSale(payload: object) {
  const localId = "OFL" + Date.now();
  await db.offlineSales.add({ localId, payload: JSON.stringify(payload), synced: 0, createdAt: Date.now() });
  return localId;
}

export function isOnline() {
  return navigator.onLine;
}
