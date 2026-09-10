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
    if (callerError || !caller?.active || caller.role !== "admin") return json({ error: "Somente administradores podem editar usuários." }, 403);

    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!userId) return json({ error: "Usuário não informado." }, 400);
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: "Nome de usuário inválido." }, 400);
    if (password && password.length < 8) return json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, 400);

    const { data: target, error: targetError } = await admin.from("profiles").select("id,username,full_name,deleted_at").eq("id", userId).maybeSingle();
    if (targetError || !target?.id || target.deleted_at) return json({ error: "Usuário não encontrado." }, 404);

    const { data: duplicate, error: duplicateError } = await admin.from("profiles").select("id").ilike("username", username).neq("id", userId).is("deleted_at", null).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate?.id) return json({ error: "Este nome de usuário já está em uso." }, 409);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { username, updated_at: now };

    if (password) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password, user_metadata: { username, full_name: target.full_name } });
      if (passwordError) throw passwordError;
      patch.active = true;
      patch.must_set_password = false;
    } else {
      const { error: metadataError } = await admin.auth.admin.updateUserById(userId, { user_metadata: { username, full_name: target.full_name } });
      if (metadataError) throw metadataError;
    }

    const { error: updateError } = await admin.from("profiles").update(patch).eq("id", userId);
    if (updateError) throw updateError;
    if (password) await admin.from("user_access_setup").delete().eq("user_id", userId);

    return json({ success: true, id: userId, username, password_changed: Boolean(password), message: password ? "Usuário e senha atualizados com sucesso." : "Nome de usuário atualizado com sucesso." });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível editar o usuário." }, 400);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
