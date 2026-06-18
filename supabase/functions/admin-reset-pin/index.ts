import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const pinPassword = (pin: string) => `OFFSIDE-${pin}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Solo administradores" }, 403);

    const { userId, newPin } = await req.json();
    if (!userId) return json({ error: "userId requerido" }, 400);

    const finalPin = newPin && /^\d{4}$/.test(newPin)
      ? newPin
      : String(Math.floor(1000 + Math.random() * 9000));

    const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
      password: pinPassword(finalPin),
    });
    if (upErr) return json({ error: upErr.message }, 400);

    // Clear lockout
    await admin.from("profiles").update({
      failed_pin_attempts: 0,
      locked_until: null,
    }).eq("user_id", userId);

    return json({ ok: true, pin: finalPin });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
