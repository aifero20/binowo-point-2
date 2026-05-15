export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          customer_code: string
          customer_name: string
          customer_type: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_code: string
          customer_name: string
          customer_type?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_code?: string
          customer_name?: string
          customer_type?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_units: {
        Row: {
          conversion_qty: number
          created_at: string
          id: string
          product_id: string
          retail_price: number
          unit_name: string
          wholesale_price: number
        }
        Insert: {
          conversion_qty?: number
          created_at?: string
          id?: string
          product_id: string
          retail_price?: number
          unit_name: string
          wholesale_price?: number
        }
        Update: {
          conversion_qty?: number
          created_at?: string
          id?: string
          product_id?: string
          retail_price?: number
          unit_name?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          created_at: string
          current_buy_price: number
          current_retail_price: number
          current_wholesale_price: number
          default_unit: string
          deleted_at: string | null
          group_code: string | null
          id: string
          is_active: boolean
          minimum_stock: number
          product_code: string
          product_name: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          current_buy_price?: number
          current_retail_price?: number
          current_wholesale_price?: number
          default_unit?: string
          deleted_at?: string | null
          group_code?: string | null
          id?: string
          is_active?: boolean
          minimum_stock?: number
          product_code: string
          product_name: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          current_buy_price?: number
          current_retail_price?: number
          current_wholesale_price?: number
          default_unit?: string
          deleted_at?: string | null
          group_code?: string | null
          id?: string
          is_active?: boolean
          minimum_stock?: number
          product_code?: string
          product_name?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_code: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
          user_code: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      purchase_details: {
        Row: {
          buy_price: number
          discount: number
          id: string
          product_id: string
          purchase_id: string
          qty: number
          retail_price: number
          total: number
          unit_name: string
          warehouse_id: string
          wholesale_price: number
        }
        Insert: {
          buy_price?: number
          discount?: number
          id?: string
          product_id: string
          purchase_id: string
          qty: number
          retail_price?: number
          total?: number
          unit_name: string
          warehouse_id: string
          wholesale_price?: number
        }
        Update: {
          buy_price?: number
          discount?: number
          id?: string
          product_id?: string
          purchase_id?: string
          qty?: number
          retail_price?: number
          total?: number
          unit_name?: string
          warehouse_id?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_details_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_details_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_headers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_percent: number
          grand_total: number
          id: string
          invoice_number: string | null
          notes: string | null
          payment_status: string
          purchase_number: string
          subtotal: number
          supplier_id: string
          tax_percent: number
          transaction_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_percent?: number
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string
          purchase_number: string
          subtotal?: number
          supplier_id: string
          tax_percent?: number
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_percent?: number
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string
          purchase_number?: string
          subtotal?: number
          supplier_id?: string
          tax_percent?: number
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_headers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_details: {
        Row: {
          discount: number
          id: string
          product_id: string
          qty: number
          sales_id: string
          selling_price: number
          total: number
          unit_name: string
          warehouse_id: string
        }
        Insert: {
          discount?: number
          id?: string
          product_id: string
          qty: number
          sales_id: string
          selling_price?: number
          total?: number
          unit_name: string
          warehouse_id: string
        }
        Update: {
          discount?: number
          id?: string
          product_id?: string
          qty?: number
          sales_id?: string
          selling_price?: number
          total?: number
          unit_name?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_details_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_details_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_headers: {
        Row: {
          cashier_id: string | null
          change_amount: number
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          discount: number
          grand_total: number
          hold_status: boolean
          id: string
          notes: string | null
          payment_amount: number
          payment_method: string
          sales_number: string
          subtotal: number
          transaction_date: string
          transaction_status: string
          updated_at: string
        }
        Insert: {
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          hold_status?: boolean
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_method?: string
          sales_number: string
          subtotal?: number
          transaction_date?: string
          transaction_status?: string
          updated_at?: string
        }
        Update: {
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          hold_status?: boolean
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_method?: string
          sales_number?: string
          subtotal?: number
          transaction_date?: string
          transaction_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_headers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number | null
          created_at: string
          created_by: string | null
          id: string
          movement_date: string
          notes: string | null
          product_id: string
          qty_in: number
          qty_out: number
          reference_number: string | null
          transaction_type: string
          warehouse_id: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_date?: string
          notes?: string | null
          product_id: string
          qty_in?: number
          qty_out?: number
          reference_number?: string | null
          transaction_type: string
          warehouse_id: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_date?: string
          notes?: string | null
          product_id?: string
          qty_in?: number
          qty_out?: number
          reference_number?: string | null
          transaction_type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          fax: string | null
          id: string
          is_active: boolean
          phone: string | null
          supplier_code: string
          supplier_name: string
          supplier_type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          supplier_code: string
          supplier_name: string
          supplier_type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          supplier_code?: string
          supplier_name?: string
          supplier_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          warehouse_code: string
          warehouse_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          warehouse_code: string
          warehouse_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          warehouse_code?: string
          warehouse_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_stock_balance: {
        Row: {
          balance: number | null
          product_id: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "supervisor" | "kasir"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "supervisor", "kasir"],
    },
  },
} as const
