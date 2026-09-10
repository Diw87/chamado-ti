import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://diw87.github.io",
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Backend não configurado." }, 500);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);

    const { data: caller, error: callerError } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", user.id)
      .single();

    if (callerError || !caller?.active || caller.role !== "admin") {
      return json({ error: "Somente administradores podem excluir usuários." }, 403);
    }

    const body = await req.json();
    const targetId = String(body.user_id || "").trim();
    if (!targetId) return json({ error: "Usuário inválido." }, 400);
    if (targetId === user.id) return json({ error: "Você não pode excluir sua própria conta." }, 400);

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,full_name,username,role,active,deleted_at")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError || !target) return json({ error: "Usuário não encontrado." }, 404);
    if (target.deleted_at) return json({ error: "Este usuário já foi excluído." }, 409);

    if (target.role === "admin") {
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("active", true)
        .is("deleted_at", null);
      if (countError) throw countError;
      if ((count || 0) <= 1) return json({ error: "Não é possível excluir o último administrador ativo." }, 400);
    }

    const { count: requesterTickets, error: ticketCountError } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", targetId);
    if (ticketCountError) throw ticketCountError;

    if ((requesterTickets || 0) > 0) {
      const { error: archiveError } = await admin
        .from("profiles")
        .update({ active: false, username: null, deleted_at: new Date().toISOString() })
        .eq("id", targetId);
      if (archiveError) throw archiveError;
      return json({ ok: true, mode: "archived", message: "Usuário removido. O histórico dos chamados foi preservado." });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) throw deleteError;

    return json({ ok: true, mode: "deleted", message: "Usuário excluído definitivamente." });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 400);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
