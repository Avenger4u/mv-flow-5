import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if there are any existing users
    const { count: userCount, error: countError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error("Error checking user count:", countError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isFirstUser = (userCount ?? 0) === 0;

    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, full_name: fullName });

    if (profileError) {
      console.error("Profile error:", profileError);
    }

    // Assign role - first user gets super_admin, others get user
    const role = isFirstUser ? 'super_admin' : 'user';
    
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (roleError) {
      console.error("Role error:", roleError);
      // Don't fail the signup, but log the error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        isFirstUser,
        message: isFirstUser 
          ? "Account created! You are the Super Admin." 
          : "Account created! Please wait for admin approval to access the app."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
