export interface User {
  id: string
  user_code: string
  full_name: string
  email?: string
  role_code: string
  is_admin: boolean
  is_supervisor: boolean
  is_active: boolean
}

export interface Product {
  id: string
  product_code: string
  barcode?: string
  product_name: string
  group_code?: string
  supplier_id?: string
  default_unit: string
  current_buy_price: number
  current_retail_price: number
  current_wholesale_price: number
  minimum_stock: number
  is_active: boolean
}

export interface ProductUnit {
  id: string
  product_id: string
  unit_name: string
  conversion_qty: number
  retail_price: number
  wholesale_price: number
}

export interface Supplier {
  id: string
  supplier_code: string
  supplier_name: string
  address?: string
  city?: string
  phone?: string
  supplier_type?: string
  is_active: boolean
}

export interface Customer {
  id: string
  customer_code: string
  customer_name: string
  address?: string
  city?: string
  phone?: string
  customer_type?: string
  is_active: boolean
}

export interface Warehouse {
  id: string
  warehouse_code: string
  warehouse_name: string
  is_active: boolean
}

export interface SaleItem {
  product_id: string
  product_name: string
  product_code: string
  warehouse_id: string
  qty: number
  unit_name: string
  selling_price: number
  discount: number
  total: number
}

export interface StockMovement {
  id: string
  movement_date: string
  transaction_type: string
  reference_number: string
  product_id: string
  warehouse_id: string
  qty_in: number
  qty_out: number
  balance_after: number
}
