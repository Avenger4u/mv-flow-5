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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      material_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          category_id: string | null
          created_at: string
          current_stock: number
          id: string
          image_url: string | null
          min_stock: number | null
          name: string
          notes: string | null
          opening_stock: number
          rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          min_stock?: number | null
          name: string
          notes?: string | null
          opening_stock?: number
          rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          min_stock?: number | null
          name?: string
          notes?: string | null
          opening_stock?: number
          rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_counter: {
        Row: {
          current_number: number
          id: number
          prefix: string
        }
        Insert: {
          current_number?: number
          id?: number
          prefix?: string
        }
        Update: {
          current_number?: number
          id?: number
          prefix?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          particular: string
          quantity: number
          quantity_unit: string
          rate_per_dzn: number
          serial_no: number
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          particular: string
          quantity: number
          quantity_unit?: string
          rate_per_dzn: number
          serial_no: number
          total: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          particular?: string
          quantity?: number
          quantity_unit?: string
          rate_per_dzn?: number
          serial_no?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_templates: {
        Row: {
          created_at: string
          deductions: Json
          id: string
          items: Json
          name: string
          notes: string | null
          party_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deductions?: Json
          id?: string
          items?: Json
          name: string
          notes?: string | null
          party_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deductions?: Json
          id?: string
          items?: Json
          name?: string
          notes?: string | null
          party_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_templates_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          net_total: number
          notes: string | null
          order_date: string
          order_number: string
          party_id: string | null
          raw_material_deductions: number
          status: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          net_total?: number
          notes?: string | null
          order_date?: string
          order_number: string
          party_id?: string | null
          raw_material_deductions?: number
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          net_total?: number
          notes?: string | null
          order_date?: string
          order_number?: string
          party_id?: string | null
          raw_material_deductions?: number
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          last_order_number: number
          name: string
          notes: string | null
          phone: string | null
          prefix: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_number?: number
          name: string
          notes?: string | null
          phone?: string | null
          prefix?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_number?: number
          name?: string
          notes?: string | null
          phone?: string | null
          prefix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_material_deductions: {
        Row: {
          amount: number
          created_at: string
          id: string
          material_name: string
          order_id: string
          quantity: number
          rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          material_name: string
          order_id: string
          quantity: number
          rate: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          material_name?: string
          order_id?: string
          quantity?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_deductions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          balance_after: number | null
          created_at: string
          id: string
          material_id: string
          notes: string | null
          order_id: string | null
          order_number: string | null
          party_id: string | null
          quantity: number
          rate: number | null
          reason_type: string | null
          remarks: string | null
          source_type: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          party_id?: string | null
          quantity: number
          rate?: number | null
          reason_type?: string | null
          remarks?: string | null
          source_type?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          party_id?: string | null
          quantity?: number
          rate?: number | null
          reason_type?: string | null
          remarks?: string | null
          source_type?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_party_prefix: { Args: { party_name: string }; Returns: string }
      get_next_order_number: { Args: never; Returns: string }
      get_party_order_number: { Args: { p_party_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      stock_in_source:
        | "market_purchase"
        | "party_supply"
        | "other_supplier"
        | "return"
        | "adjustment"
        | "opening_stock"
      stock_out_reason:
        | "used_in_order"
        | "wastage"
        | "sample"
        | "damage"
        | "returned"
        | "adjustment"
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
      app_role: ["admin", "user", "super_admin"],
      stock_in_source: [
        "market_purchase",
        "party_supply",
        "other_supplier",
        "return",
        "adjustment",
        "opening_stock",
      ],
      stock_out_reason: [
        "used_in_order",
        "wastage",
        "sample",
        "damage",
        "returned",
        "adjustment",
      ],
    },
  },
} as const
