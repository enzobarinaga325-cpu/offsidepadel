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
const synthEmail = (phone: string) => `phone_${normalize(phone)}@offside.local`;
const pinPassword = (pin: string) => `OFFSIDE-${pin}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { firstName, lastName, phone, pin, categoryId } = await req.json();

    if (!firstName?.trim() || !lastName?.trim()) return json({ error: "Nombre y apellido son obligatorios." }, 400);
    const phoneN = normalize(phone || "");
    if (phoneN.length < 8) return json({ error: "Número de celular inválido." }, 400);
    if (!/^\d{4}$/.test(pin || "")) return json({ error: "El PIN debe tener exactamente 4 dígitos." }, 400);
    if (!categoryId) return json({ error: "Seleccioná una categoría." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Uniqueness check
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .eq("phone_e164", phoneN)
      .maybeSingle();
    if (existing) return json({ error: "El número de celular ya está registrado." }, 409);

    const email = synthEmail(phoneN);
    const password = pinPassword(pin);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phoneN,
        category_id: categoryId,
      },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || "No se pudo crear la cuenta." }, 400);
    }

    // Ensure category persisted (in case trigger ran before metadata committed)
    await admin
      .from("profiles")
      .update({
        category_id: categoryId,
        phone_e164: phoneN,
        phone: phoneN,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      })
      .eq("user_id", created.user.id);

    return json({ ok: true, email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
