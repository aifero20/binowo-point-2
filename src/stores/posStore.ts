import { create } from 'zustand'
import type { SaleItem } from '@/types'

interface PosStore {
  items: SaleItem[]
  customerId: string | null
  warehouseId: string | null
  addItem: (item: SaleItem) => void
  updateQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  setCustomer: (id: string | null) => void
  setWarehouse: (id: string) => void
  clearCart: () => void
  subtotal: () => number
  grandTotal: () => number
}

export const usePosStore = create<PosStore>((set, get) => ({
  items: [],
  customerId: null,
  warehouseId: null,

  addItem: (newItem) => {
    const items = get().items
    const existing = items.find(
      (i) => i.product_id === newItem.product_id && i.unit_name === newItem.unit_name
    )
    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === newItem.product_id && i.unit_name === newItem.unit_name
            ? { ...i, qty: i.qty + newItem.qty, total: (i.qty + newItem.qty) * i.selling_price }
            : i
        ),
      })
    } else {
      set({ items: [...items, newItem] })
    }
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return }
    set({
      items: get().items.map((i) =>
        i.product_id === productId ? { ...i, qty, total: qty * i.selling_price } : i
      ),
    })
  },

  removeItem: (productId) => set({ items: get().items.filter((i) => i.product_id !== productId) }),
  setCustomer: (id) => set({ customerId: id }),
  setWarehouse: (id) => set({ warehouseId: id }),
  clearCart: () => set({ items: [], customerId: null }),
  subtotal: () => get().items.reduce((sum, i) => sum + i.total, 0),
  grandTotal: () => get().subtotal(),
}))
