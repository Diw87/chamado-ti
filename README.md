# CHAMADO T.I. 3.0

Central de Serviços de Tecnologia da Informação da Prefeitura Municipal de Olho d'Água das Cunhãs.

## O que mudou na versão 3.0

A versão 3.0 transforma o projeto em uma aplicação multiusuário preparada para produção, mantendo o front-end no GitHub Pages e usando Supabase como backend.

### Recursos

- Login com e-mail e senha
- Perfis: Solicitante, Técnico e Administrador
- Banco PostgreSQL centralizado
- Chamados compartilhados entre computadores e secretarias
- Atualização em tempo real
- Numeração automática de protocolo `TI-AAAA-00000`
- Controle de SLA: Crítica 4h, Alta 8h, Média 24h e Baixa 48h
- Fila prioritária
- Histórico de movimentações
- Notas internas exclusivas da equipe de T.I.
- Atribuição de técnico responsável
- Alteração de prioridade e status
- Anexos privados de até 10 MB
- Links temporários para abrir anexos
- Relatórios e indicadores operacionais
- Exportação CSV
- Gestão de usuários pelo Administrador
- Interface responsiva para computador, tablet e celular
- Modo demonstração enquanto o backend não estiver configurado

## Arquitetura

```text
GitHub Pages
    |
    | Supabase JS + chave pública anon/publishable
    v
Supabase Auth
Supabase PostgreSQL + RLS
Supabase Realtime
Supabase Storage privado
Supabase Edge Function create-user
```

A chave `service_role` nunca deve ficar no GitHub ou no navegador. Ela é usada somente no ambiente protegido da Edge Function.

## Arquivos principais

- `index.html` — interface da Central de Serviços
- `style.css` — identidade visual responsiva
- `config.js` — URL pública do projeto + chave anon/publishable
- `app.js` — carregador dos módulos
- `app-core.js` — autenticação, sessão e sincronização
- `app-render.js` — dashboards, tabelas e relatórios
- `app-actions.js` — chamados, histórico, anexos e usuários
- `app-utils.js` — SLA, utilitários e modo demonstração
- `manifest.webmanifest` — configuração PWA
- `supabase/schema.sql` — banco, triggers, RLS, Storage e Realtime
- `supabase/002_security_hardening.sql` — bloqueio de contas novas até ativação administrativa
- `supabase/bootstrap-admin.sql` — promoção do primeiro administrador
- `supabase/functions/create-user/index.ts` — criação segura de usuários

## Implantação do Supabase

1. Crie ou escolha um projeto Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Execute `supabase/002_security_hardening.sql` imediatamente depois.
4. Crie o primeiro usuário em **Authentication > Users**.
5. Execute `supabase/bootstrap-admin.sql`, substituindo `SEU_EMAIL_ADMIN` pelo e-mail do primeiro administrador.
6. Faça deploy da função `supabase/functions/create-user`.
7. No arquivo `config.js`, informe apenas:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon/publishable)
8. Em produção, mantenha o cadastro público de usuários desabilitado; novos usuários devem ser criados pelo Administrador dentro da Central.

## GitHub Pages

Publicação recomendada:

- Branch: `main`
- Diretório: `/ (root)`

Após o backend ser conectado, qualquer usuário autorizado poderá acessar o mesmo endereço do GitHub Pages, entrar com sua conta e trabalhar sobre o mesmo banco central.

## Segurança

O banco utiliza Row Level Security (RLS):

- solicitantes veem apenas seus próprios chamados;
- técnicos e administradores veem todos os chamados;
- apenas a equipe de T.I. altera status, prioridade e responsável;
- notas internas são ocultadas dos solicitantes;
- anexos são privados;
- criação administrativa de usuários ocorre no servidor;
- novas contas começam inativas e precisam ser liberadas pelo fluxo administrativo;
- contas inativas não acessam os dados operacionais.

## Observação

Enquanto `config.js` estiver sem as credenciais públicas do Supabase, o site inicia em **modo demonstração**, permitindo testar toda a interface sem afetar dados reais.
