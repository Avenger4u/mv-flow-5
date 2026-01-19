// Deno edge function: Backfill stock_transactions from existing raw_material_deductions
// Creates stock_out entries for all order deductions that don't already have corresponding transactions

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // Get all orders with their raw_material_deductions
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select(`
        id,
        order_number,
        order_date,
        party_id,
        raw_material_deductions (
          id,
          material_name,
          quantity,
          rate,
          amount
        )
      `)
      .order("order_date", { ascending: true });

    if (ordersErr) throw ordersErr;

    // Get existing order transactions to avoid duplicates
    const { data: existingTx, error: existingErr } = await admin
      .from("stock_transactions")
      .select("order_id")
      .not("order_id", "is", null);

    if (existingErr) throw existingErr;

    const existingOrderIds = new Set((existingTx ?? []).map(t => t.order_id));

    // Get all materials to map names to IDs
    const { data: materials, error: materialsErr } = await admin
      .from("materials")
      .select("id, name, current_stock");

    if (materialsErr) throw materialsErr;

    const materialMap = new Map<string, { id: string; current_stock: number }>();
    (materials ?? []).forEach(m => {
      materialMap.set(m.name.toLowerCase().trim(), { id: m.id, current_stock: m.current_stock });
    });

    const newTransactions: any[] = [];
    const stockUpdates: { id: string; newStock: number }[] = [];

    // Track running balances for each material
    const runningBalances = new Map<string, number>();
    (materials ?? []).forEach(m => {
      runningBalances.set(m.id, m.current_stock);
    });

    for (const order of orders ?? []) {
      // Skip if already has transactions
      if (existingOrderIds.has(order.id)) continue;

      const deductions = order.raw_material_deductions || [];
      
      for (const deduction of deductions) {
        // Find material by name (case-insensitive)
        const materialInfo = materialMap.get(deduction.material_name.toLowerCase().trim());
        
        if (materialInfo) {
          const currentBalance = runningBalances.get(materialInfo.id) || 0;
          const newBalance = currentBalance - deduction.quantity;
          runningBalances.set(materialInfo.id, newBalance);

          newTransactions.push({
            material_id: materialInfo.id,
            transaction_type: "out",
            quantity: deduction.quantity,
            transaction_date: order.order_date,
            reason_type: "used_in_order",
            order_id: order.id,
            order_number: order.order_number,
            party_id: order.party_id,
            rate: deduction.rate,
            balance_after: newBalance,
            remarks: `Order deduction backfill - ${order.order_number}`,
          });
        }
      }
    }

    if (newTransactions.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No new transactions to sync" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert all new transactions
    const { error: insertErr } = await admin.from("stock_transactions").insert(newTransactions);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ 
      synced: newTransactions.length,
      message: `Successfully synced ${newTransactions.length} order deductions to stock ledger`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("sync-order-ledger error", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
