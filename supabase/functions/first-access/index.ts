import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = "https://diw87.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Backend não configurado." }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const accessCode = normalizeCode(String(body.access_code || ""));
    const password = String(body.password || "");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: "Usuário inválido." }, 400);
    if (accessCode.length !== 12) return json({ error: "Código de primeiro acesso inválido." }, 400);
    if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
    const { data: profile, error: profileError } = await admin.from("profiles").select("id,username,must_set_password,deleted_at").ilike("username", username).is("deleted_at", null).maybeSingle();
    if (profileError || !profile?.id) return json({ error: "Usuário ou código inválidos." }, 400);
    if (!profile.must_set_password) return json({ error: "Este usuário já concluiu o primeiro acesso." }, 409);
    const { data: setup, error: setupError } = await admin.from("user_access_setup").select("code_hash,expires_at,attempts").eq("user_id", profile.id).maybeSingle();
    if (setupError || !setup) return json({ error: "Código indisponível. Solicite um novo código ao administrador." }, 400);
    if (new Date(setup.expires_at).getTime() < Date.now()) return json({ error: "Código expirado. Solicite um novo código ao administrador." }, 410);
    if ((setup.attempts || 0) >= 10) return json({ error: "Código bloqueado por excesso de tentativas. Solicite um novo código ao administrador." }, 429);
    const incomingHash = await sha256(accessCode);
    if (incomingHash !== setup.code_hash) {
      await admin.from("user_access_setup").update({ attempts: (setup.attempts || 0) + 1 }).eq("user_id", profile.id);
      return json({ error: "Usuário ou código inválidos." }, 400);
    }
    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { password });
    if (passwordError) throw passwordError;
    const { error: activateError } = await admin.from("profiles").update({ active: true, must_set_password: false, updated_at: new Date().toISOString() }).eq("id", profile.id);
    if (activateError) throw activateError;
    await admin.from("user_access_setup").delete().eq("user_id", profile.id);
    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (authUserError || !email) return json({ success: true, username, login_required: true });
    const authClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({ email, password });
    if (loginError || !loginData.session) return json({ success: true, username, login_required: true });
    return json({ success: true, username, access_token: loginData.session.access_token, refresh_token: loginData.session.refresh_token, expires_in: loginData.session.expires_in, token_type: loginData.session.token_type });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível concluir o primeiro acesso." }, 400);
  }
});
function normalizeCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }
