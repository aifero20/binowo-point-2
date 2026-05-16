import Dexie, { type Table } from "dexie";

export interface OfflineSale {
  id?: number;
  localId: string;
  payload: string;
  synced: boolean;
  createdAt: number;
}

export interface OfflineProduct {
  id: string;
  product_code: string;
  product_name: string;
  barcode: string | null;
  default_unit: string;
  current_retail_price: number;
  current_wholesale_price: number;
  cachedAt: number;
}

class BinowoDb extends Dexie {
  offlineSales!: Table<OfflineSale>;
  offlineProducts!: Table<OfflineProduct>;

  constructor() {
    super("binowo-db");
    this.version(1).stores({
      offlineSales: "++id, localId, synced, createdAt",
      offlineProducts: "id, product_code, barcode, cachedAt",
    });
  }
}

export const db = new BinowoDb();
