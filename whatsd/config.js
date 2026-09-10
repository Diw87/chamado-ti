// WhatsD — configuração própria do mensageiro
// Dados públicos do Supabase. Nunca coloque service_role neste arquivo.
window.WHATSD_CONFIG = {
  SUPABASE_URL: 'https://ecptjdykrzyiekunxylx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_7KNgN5uT6Mywv0rTYv3dtw_QQS7f1Of',
  USERNAME_DOMAIN: 'whatsd.local'
};

// Compatibilidade temporária com o app.js atual, sem depender do config do Chamado T.I.
window.CHAMADO_TI_CONFIG = window.WHATSD_CONFIG;
