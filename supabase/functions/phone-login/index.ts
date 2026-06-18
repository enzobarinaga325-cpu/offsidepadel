import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (p: string) => (p || "").replace(/\D/g, "");
const synthEmail = (phoneN: string) => `phone_${phoneN}@offside.local`;
const pinPassword = (pin: string) => `OFFSIDE-${pin}`;

const GENERIC_ERR = "El número de celular o el PIN son incorrectos.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { phone, pin } = await req.json();
    const phoneN = normalize(phone || "");
    if (!phoneN || !/^\d{4}$/.test(pin || "")) return json({ error: GENERIC_ERR }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pre } = await admin.rpc("phone_login_precheck", { _phone: phoneN });
    const row = Array.isArray(pre) ? pre[0] : pre;
    if (!row) return json({ error: GENERIC_ERR }, 401);
    if (row.active === false) return json({ error: "Tu cuenta está desactivada. Comunicate con la administración." }, 403);
    if (row.locked) {
      return json({ error: "Cuenta bloqueada por demasiados intentos. Esperá 5 minutos." }, 423);
    }

    // Attempt sign-in via anon client
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
      email: synthEmail(phoneN),
      password: pinPassword(pin),
    });

    if (signErr || !signed.session) {
      const { data: lockUntil } = await admin.rpc("phone_login_register_failure", { _phone: phoneN });
      if (lockUntil) {
        return json({ error: "Demasiados intentos. Tu cuenta quedó bloqueada por 5 minutos." }, 423);
      }
      return json({ error: GENERIC_ERR }, 401);
    }

    await admin.rpc("phone_login_register_success", { _phone: phoneN });
    return json({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
