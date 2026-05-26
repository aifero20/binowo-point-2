import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated and is OWNER/ADMIN
    const authHeader = req.headers.get("Authorization");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader?.replace("Bearer ", "") ?? "");
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: caller } = await supabaseAdmin.from("users").select("role_code").eq("id", user.id).single();
    if (!caller || !["OWNER", "ADMIN"].includes(caller.role_code)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, userId, email, password, userData } = body;

    if (action === "create") {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      const { error: insertError } = await supabaseAdmin.from("users").insert({
        id: authData.user.id,
        email,
        ...userData,
      });
      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, userId: authData.user.id }), { headers: corsHeaders });
    }

    if (action === "update") {
      // Update auth.users jika ada perubahan email/password
      const authUpdate: Record<string, string> = {};
      if (email) authUpdate.email = email;
      if (password) authUpdate.password = password;

      if (Object.keys(authUpdate).length > 0) {
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
        if (updateAuthError) throw updateAuthError;
      }

      // Update public.users
      const { error: updateError } = await supabaseAdmin.from("users").update({
        ...userData,
        ...(email ? { email } : {}),
      }).eq("id", userId);
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "deactivate") {
      const { error } = await supabaseAdmin.from("users").update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      }).eq("id", userId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
