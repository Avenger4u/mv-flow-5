// Deno edge function: initialize opening ledger entries from current material stock
// Creates a one-time opening balance snapshot so reports can calculate opening/closing from ledger.

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

    // Only allow initialization when ledger is empty (idempotent safety)
    const { count: txCount, error: countErr } = await admin
      .from("stock_transactions")
      .select("id", { count: "exact", head: true });

    if (countErr) throw countErr;

    if ((txCount ?? 0) > 0) {
      return new Response(JSON.stringify({ inserted: 0, alreadyInitialized: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: materials, error: materialsErr } = await admin
      .from("materials")
      .select("id, name, current_stock")
      .order("created_at", { ascending: true });

    if (materialsErr) throw materialsErr;

    const snapshotDate = "2000-01-01";

    const rows = (materials ?? [])
      .filter((m) => (m.current_stock ?? 0) > 0)
      .map((m) => ({
        material_id: m.id,
        transaction_type: "add",  // use 'add' which is allowed by check constraint
        quantity: m.current_stock,
        transaction_date: snapshotDate,
        source_type: "opening_stock",
        balance_after: m.current_stock,
        remarks: "Opening balance snapshot (initialized from current stock)",
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await admin.from("stock_transactions").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ inserted: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("init-stock-ledger error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
