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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Backend não configurado." }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerUserError } = await admin.auth.getUser(token);
    const callerId = callerData?.user?.id;
    if (callerUserError || !callerId) return json({ error: "Sessão inválida." }, 401);
    const { data: caller, error: callerError } = await admin.from("profiles").select("role,active").eq("id", callerId).single();
    if (callerError || !caller?.active || caller.role !== "admin") return json({ error: "Somente administradores podem redefinir acessos." }, 403);
    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    if (!userId) return json({ error: "Usuário não informado." }, 400);
    if (userId === callerId) return json({ error: "Use a troca de senha da sua própria conta, não a redefinição administrativa." }, 400);
    const { data: target, error: targetError } = await admin.from("profiles").select("id,username,full_name,deleted_at").eq("id", userId).maybeSingle();
    if (targetError || !target?.id || target.deleted_at) return json({ error: "Usuário não encontrado." }, 404);
    const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
    if (pwError) throw pwError;
    const accessCode = generateCode();
    const codeHash = await sha256(normalizeCode(accessCode));
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: profileError } = await admin.from("profiles").update({ active: false, must_set_password: true, updated_at: new Date().toISOString() }).eq("id", userId);
    if (profileError) throw profileError;
    const { error: setupError } = await admin.from("user_access_setup").upsert({ user_id: userId, code_hash: codeHash, expires_at: expiresAt, attempts: 0, created_by: callerId, created_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (setupError) throw setupError;
    return json({ success: true, username: target.username, full_name: target.full_name, access_code: accessCode, expires_at: expiresAt, first_access_required: true });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível redefinir o acesso." }, 400);
  }
});
function generateCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = new Uint8Array(12); crypto.getRandomValues(bytes); const raw = [...bytes].map(b => alphabet[b % alphabet.length]).join(""); return `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`; }
function normalizeCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }
