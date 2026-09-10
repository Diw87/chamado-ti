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
    if (callerError || !caller?.active || caller.role !== "admin") return json({ error: "Somente administradores podem criar usuários." }, 403);
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const departmentId = String(body.department_id || "").trim();
    const role = String(body.role || "requester");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: "Usuário inválido. Use 3 a 32 caracteres: letras, números, ponto, hífen ou underline." }, 400);
    if (fullName.length < 2) return json({ error: "Informe o nome completo." }, 400);
    if (!departmentId) return json({ error: "Selecione uma secretaria/setor." }, 400);
    if (!["requester", "technician", "admin"].includes(role)) return json({ error: "Perfil inválido." }, 400);
    const { data: existing } = await admin.from("profiles").select("id").ilike("username", username).is("deleted_at", null).maybeSingle();
    if (existing?.id) return json({ error: "Este nome de usuário já está em uso." }, 409);
    const internalEmail = `${username}@chamado-ti.local`;
    const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
    const accessCode = generateCode();
    const codeHash = await sha256(normalizeCode(accessCode));
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: internalEmail, password: temporaryPassword, email_confirm: true, user_metadata: { full_name: fullName, username } });
    if (createError || !created.user) throw createError || new Error("Falha ao criar usuário.");
    const { error: profileError } = await admin.from("profiles").update({ username, full_name: fullName, role, department_id: departmentId, active: false, must_set_password: true, deleted_at: null, updated_at: new Date().toISOString() }).eq("id", created.user.id);
    if (profileError) { await admin.auth.admin.deleteUser(created.user.id); throw profileError; }
    const { error: setupError } = await admin.from("user_access_setup").upsert({ user_id: created.user.id, code_hash: codeHash, expires_at: expiresAt, attempts: 0, created_by: callerId, created_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (setupError) { await admin.auth.admin.deleteUser(created.user.id); throw setupError; }
    return json({ id: created.user.id, username, full_name: fullName, role, access_code: accessCode, expires_at: expiresAt, first_access_required: true }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 400);
  }
});
function generateCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = new Uint8Array(12); crypto.getRandomValues(bytes); const raw = [...bytes].map(b => alphabet[b % alphabet.length]).join(""); return `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`; }
function normalizeCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }
