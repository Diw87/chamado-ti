(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (!form || !window.CHAMADO_TI_CONFIG || !window.supabase) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const config = window.CHAMADO_TI_CONFIG;
      const username = String(document.getElementById('loginUsername')?.value || '').trim().toLowerCase();
      const password = String(document.getElementById('loginPassword')?.value || '');
      const status = document.getElementById('loginStatus');
      const button = document.getElementById('loginButton');

      if (status) status.textContent = '';
      if (!/^[a-z0-9._-]{3,32}$/.test(username) || !password) {
        if (status) status.textContent = 'Informe usuário e senha.';
        return;
      }

      const originalText = button?.textContent || 'Entrar no WhatsD';
      if (button) {
        button.disabled = true;
        button.textContent = 'Entrando...';
      }

      try {
        const response = await fetch(`${config.SUPABASE_URL}/functions/v1/whatsd-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ username, password })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Usuário ou senha inválidos.');

        const db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: 'whatsd-auth-session'
          }
        });

        const { data, error } = await db.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token
        });

        if (error || !data?.session) throw error || new Error('Não foi possível iniciar a sessão.');
        window.location.reload();
      } catch (error) {
        if (status) status.textContent = error?.message || 'Usuário ou senha inválidos.';
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }, true);
  });
})();
