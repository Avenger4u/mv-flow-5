import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated and has admin role
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for operations (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if user has admin or super_admin role
    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .limit(1);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Only admins can manage demo data', success: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'import') {
      // Clear existing data first
      await admin.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('order_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Create sample parties
      const { data: parties, error: partiesError } = await admin
        .from('parties')
        .insert([
          { name: 'Sharma Textiles', prefix: 'ST', address: 'Karol Bagh, Delhi', phone: '9876543210', email: 'sharma@example.com' },
          { name: 'Gupta Garments', prefix: 'GG', address: 'Chandni Chowk, Delhi', phone: '9876543211', email: 'gupta@example.com' },
          { name: 'Agarwal Fabrics', prefix: 'AF', address: 'Sadar Bazaar, Delhi', phone: '9876543212', email: 'agarwal@example.com' },
          { name: 'Jain Brothers', prefix: 'JB', address: 'Mathura Road, Delhi', phone: '9876543213' },
          { name: 'Bansal Trading Co', prefix: 'BT', address: 'Agra Highway, Mathura', phone: '9876543214' },
        ])
        .select();

      if (partiesError) throw partiesError;

      // Create sample material categories
      const { data: categories, error: categoriesError } = await admin
        .from('material_categories')
        .insert([
          { name: 'Fabrics' },
          { name: 'Threads' },
          { name: 'Buttons' },
          { name: 'Zippers' },
          { name: 'Laces' },
        ])
        .select();

      if (categoriesError) throw categoriesError;

      // Create sample materials
      const { data: materials, error: materialsError } = await admin
        .from('materials')
        .insert([
          { name: 'Cotton White', category_id: categories[0].id, unit: 'Mtr', rate: 120, opening_stock: 500, current_stock: 500, min_stock: 50 },
          { name: 'Silk Red', category_id: categories[0].id, unit: 'Mtr', rate: 350, opening_stock: 200, current_stock: 200, min_stock: 30 },
          { name: 'Polyester Blue', category_id: categories[0].id, unit: 'Mtr', rate: 80, opening_stock: 300, current_stock: 300, min_stock: 40 },
          { name: 'Thread Black', category_id: categories[1].id, unit: 'Pcs', rate: 25, opening_stock: 1000, current_stock: 1000, min_stock: 100 },
          { name: 'Thread White', category_id: categories[1].id, unit: 'Pcs', rate: 25, opening_stock: 800, current_stock: 800, min_stock: 100 },
          { name: 'Button Gold', category_id: categories[2].id, unit: 'Pcs', rate: 5, opening_stock: 5000, current_stock: 5000, min_stock: 500 },
          { name: 'Zipper Metal 6in', category_id: categories[3].id, unit: 'Pcs', rate: 15, opening_stock: 200, current_stock: 200, min_stock: 50 },
          { name: 'Lace Border Gold', category_id: categories[4].id, unit: 'Mtr', rate: 45, opening_stock: 150, current_stock: 150, min_stock: 20 },
        ])
        .select();

      if (materialsError) throw materialsError;

      // Create stock transactions for opening stock
      const stockTransactions = materials.map(m => ({
        material_id: m.id,
        transaction_type: 'in',
        quantity: m.opening_stock,
        transaction_date: new Date().toISOString().split('T')[0],
        source_type: 'opening_stock',
        balance_after: m.opening_stock,
        remarks: 'Opening stock entry (Demo)',
      }));

      const { error: stockTxError } = await admin
        .from('stock_transactions')
        .insert(stockTransactions);

      if (stockTxError) throw stockTxError;

      // Create sample orders
      if (parties && parties.length >= 2) {
        // Order 1
        const { data: order1, error: order1Error } = await admin
          .from('orders')
          .insert({
            order_number: `${parties[0].prefix}/001`,
            party_id: parties[0].id,
            order_date: new Date().toISOString().split('T')[0],
            subtotal: 15000,
            raw_material_deductions: 2000,
            net_total: 13000,
            status: 'pending',
          })
          .select()
          .single();

        if (order1Error) throw order1Error;

        await admin.from('order_items').insert([
          { order_id: order1.id, serial_no: 1, particular: 'Cotton Kurta - White', quantity: 10, quantity_unit: 'Dzn', rate_per_dzn: 800, total: 8000 },
          { order_id: order1.id, serial_no: 2, particular: 'Silk Dupatta - Red', quantity: 5, quantity_unit: 'Dzn', rate_per_dzn: 1400, total: 7000 },
        ]);

        await admin.from('raw_material_deductions').insert([
          { order_id: order1.id, material_name: 'Cotton White', quantity: 10, rate: 120, amount: 1200 },
          { order_id: order1.id, material_name: 'Thread White', quantity: 32, rate: 25, amount: 800 },
        ]);

        await admin.from('parties').update({ last_order_number: 1 }).eq('id', parties[0].id);

        // Order 2
        const { data: order2, error: order2Error } = await admin
          .from('orders')
          .insert({
            order_number: `${parties[1].prefix}/001`,
            party_id: parties[1].id,
            order_date: new Date().toISOString().split('T')[0],
            subtotal: 22000,
            raw_material_deductions: 3500,
            net_total: 18500,
            status: 'completed',
          })
          .select()
          .single();

        if (order2Error) throw order2Error;

        await admin.from('order_items').insert([
          { order_id: order2.id, serial_no: 1, particular: 'Polyester Shirt - Blue', quantity: 15, quantity_unit: 'Dzn', rate_per_dzn: 600, total: 9000 },
          { order_id: order2.id, serial_no: 2, particular: 'Cotton Pant - Black', quantity: 8, quantity_unit: 'Dzn', rate_per_dzn: 1000, total: 8000 },
          { order_id: order2.id, serial_no: 3, particular: 'Jacket - Navy', quantity: 5, quantity_unit: 'Dzn', rate_per_dzn: 1000, total: 5000 },
        ]);

        await admin.from('raw_material_deductions').insert([
          { order_id: order2.id, material_name: 'Polyester Blue', quantity: 20, rate: 80, amount: 1600 },
          { order_id: order2.id, material_name: 'Button Gold', quantity: 200, rate: 5, amount: 1000 },
          { order_id: order2.id, material_name: 'Zipper Metal 6in', quantity: 60, rate: 15, amount: 900 },
        ]);

        await admin.from('parties').update({ last_order_number: 1 }).eq('id', parties[1].id);
      }

      // Add some stock in/out entries
      if (materials && materials.length > 0) {
        await admin.from('stock_transactions').insert([
          {
            material_id: materials[0].id,
            transaction_type: 'in',
            quantity: 100,
            transaction_date: new Date().toISOString().split('T')[0],
            source_type: 'market_purchase',
            balance_after: 600,
            rate: 115,
            remarks: 'Bulk purchase from local market',
          },
          {
            material_id: materials[3].id,
            transaction_type: 'out',
            quantity: 50,
            transaction_date: new Date().toISOString().split('T')[0],
            reason_type: 'sample',
            balance_after: 950,
            remarks: 'Sample for new customer',
          },
        ]);

        await admin.from('materials').update({ current_stock: 600 }).eq('id', materials[0].id);
        await admin.from('materials').update({ current_stock: 950 }).eq('id', materials[3].id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Demo data imported successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reset') {
      // Delete in correct order to respect foreign keys
      await admin.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await admin.from('order_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset order counter
      await admin.from('order_counter').update({ current_number: 0 }).eq('id', 1);

      return new Response(
        JSON.stringify({ success: true, message: 'All data reset successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
