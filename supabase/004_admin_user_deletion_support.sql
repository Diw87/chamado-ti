-- CHAMADO T.I. 3.0 — suporte à exclusão segura de usuários

alter table public.profiles add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on public.profiles(deleted_at);
create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists ticket_events_user_idx on public.ticket_events(user_id);
create index if not exists ticket_attachments_uploaded_by_idx on public.ticket_attachments(uploaded_by);
