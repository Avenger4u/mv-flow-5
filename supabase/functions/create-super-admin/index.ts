import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if super admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const superAdmin = existingUsers?.users?.find(
      (user) => user.email === 'mysticvastra@gmail.com'
    )

    if (superAdmin) {
      // Check if role exists
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', superAdmin.id)
        .eq('role', 'super_admin')
        .single()
      
      if (!roleData) {
        // Add super_admin role
        await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: superAdmin.id, role: 'super_admin' })
      }

      return new Response(
        JSON.stringify({ message: 'Super admin already exists', success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the super admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'mysticvastra@gmail.com',
      password: 'Dinesh@9041',
      email_confirm: true,
      user_metadata: {
        full_name: 'Super Admin'
      }
    })

    if (createError) {
      throw createError
    }

    // Add super_admin role
    if (newUser?.user) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: 'super_admin' })

      if (roleError) {
        console.error('Error adding role:', roleError)
      }
    }

    return new Response(
      JSON.stringify({ message: 'Super admin created successfully', success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
