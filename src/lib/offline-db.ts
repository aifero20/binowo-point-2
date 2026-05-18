import Dexie, { type Table } from "dexie";

export interface OfflineSale {
  id?: number;
  tempId: string;
  warehouseId: string;
  paymentMethod: string;
  paymentAmount: number;
  items: {
    product_id: string;
    product_name: string;
    unit_name: string;
    qty: number;
    selling_price: number;
  }[];
  createdAt: string;
  synced: boolean;
  syncError?: string;
}

export interface OfflineProduct {
  id: string;
  product_code: string;
  product_name: string;
  barcode: string | null;
  default_unit: string;
  current_retail_price: number;
  cachedAt: string;
}

class BinowoOfflineDB extends Dexie {
  sales!: Table<OfflineSale>;
  products!: Table<OfflineProduct>;

  constructor() {
    super("binowo-offline");
    this.version(1).stores({
      sales: "++id, tempId, synced, createdAt",
      products: "id, product_code, barcode",
    });
  }
}

export const offlineDb = new BinowoOfflineDB();
