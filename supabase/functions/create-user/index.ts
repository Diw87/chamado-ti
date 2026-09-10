import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Backend não configurado." }, 500);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);

    const { data: caller, error: callerError } = await adminClient
      .from("profiles")
      .select("role,active")
      .eq("id", user.id)
      .single();

    if (callerError || !caller?.active || caller.role !== "admin") {
      return json({ error: "Somente administradores podem criar usuários." }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const departmentId = String(body.department_id || "").trim();
    const role = String(body.role || "requester");

    if (!email || !email.includes("@")) return json({ error: "E-mail inválido." }, 400);
    if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
    if (fullName.length < 2) return json({ error: "Informe o nome completo." }, 400);
    if (!departmentId) return json({ error: "Selecione uma secretaria/setor." }, 400);
    if (!["requester", "technician", "admin"].includes(role)) return json({ error: "Perfil inválido." }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) throw createError || new Error("Falha ao criar usuário.");

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ full_name: fullName, role, department_id: departmentId, active: true })
      .eq("id", created.user.id);

    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    return json({ id: created.user.id, email: created.user.email, full_name: fullName, role }, 201);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json({ error: message }, 400);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
