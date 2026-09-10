-- CHAMADO T.I. 3.0 — Supabase/PostgreSQL
-- Execute uma vez em um projeto Supabase vazio.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('requester','technician','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('baixa','media','alta','critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('aberto','atendimento','aguardando','resolvido','cancelado');
exception when duplicate_object then null; end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  acronym text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'requester',
  department_id uuid references public.departments(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.ticket_code_seq start 10001;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  technician_id uuid references public.profiles(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  description text not null check (char_length(description) between 3 and 4000),
  category text not null,
  priority public.ticket_priority not null default 'media',
  status public.ticket_status not null default 'aberto',
  contact text,
  location text,
  equipment text,
  asset_tag text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_requester_idx on public.tickets(requester_id);
create index if not exists tickets_department_idx on public.tickets(department_id);
create index if not exists tickets_technician_idx on public.tickets(technician_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_priority_idx on public.tickets(priority);
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null default 'note',
  message text not null check (char_length(message) between 1 and 2000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_events_ticket_idx on public.ticket_events(ticket_id, created_at desc);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists ticket_attachments_ticket_idx on public.ticket_attachments(ticket_id, created_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('technician','admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and (t.requester_id = auth.uid() or public.is_staff())
  );
$$;

create or replace function public.set_ticket_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sla_hours integer;
begin
  sla_hours := case new.priority
    when 'critica' then 4
    when 'alta' then 8
    when 'media' then 24
    else 48
  end;

  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      new.code := 'TI-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.ticket_code_seq')::text, 5, '0');
    end if;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    new.sla_due_at := coalesce(new.sla_due_at, new.created_at + make_interval(hours => sla_hours));
  else
    new.updated_at := now();
    if new.priority is distinct from old.priority then
      new.sla_due_at := new.created_at + make_interval(hours => sla_hours);
    end if;
  end if;

  if new.status = 'resolvido' and (tg_op = 'INSERT' or old.status is distinct from 'resolvido') then
    new.resolved_at := coalesce(new.resolved_at, now());
  elsif tg_op = 'UPDATE' and new.status is distinct from 'resolvido' and old.status = 'resolvido' then
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_system_fields on public.tickets;
create trigger trg_tickets_system_fields
before insert or update on public.tickets
for each row execute function public.set_ticket_system_fields();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, department_id, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), split_part(coalesce(new.email,'usuario'),'@',1)),
    'requester',
    null,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.departments(name, acronym) values
  ('Administração','SEMAD'),
  ('Gabinete','GAB'),
  ('Saúde','SEMUS'),
  ('Educação','SEMED'),
  ('Assistência Social','SEMAS'),
  ('Finanças','SEMF'),
  ('Agricultura','SEMAGRI'),
  ('Cultura','SEMCULT'),
  ('Infraestrutura','SEMINFRA'),
  ('Recursos Humanos','RH'),
  ('Licitação','LIC'),
  ('Tributos','TRIB'),
  ('Contabilidade','CONT'),
  ('Comunicação','COM')
on conflict (name) do update set acronym = excluded.acronym, active = true;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ticket_attachments enable row level security;

DROP POLICY IF EXISTS departments_select_authenticated ON public.departments;
create policy departments_select_authenticated on public.departments for select to authenticated using (true);
DROP POLICY IF EXISTS departments_admin_insert ON public.departments;
create policy departments_admin_insert on public.departments for insert to authenticated with check (public.is_admin());
DROP POLICY IF EXISTS departments_admin_update ON public.departments;
create policy departments_admin_update on public.departments for update to authenticated using (public.is_admin()) with check (public.is_admin());

DROP POLICY IF EXISTS profiles_select ON public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_staff() or role in ('technician','admin'));
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

DROP POLICY IF EXISTS tickets_select ON public.tickets;
create policy tickets_select on public.tickets for select to authenticated
using (requester_id = auth.uid() or public.is_staff());
DROP POLICY IF EXISTS tickets_insert ON public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
with check (requester_id = auth.uid() and public.current_profile_active());
DROP POLICY IF EXISTS tickets_staff_update ON public.tickets;
create policy tickets_staff_update on public.tickets for update to authenticated
using (public.is_staff()) with check (public.is_staff());

DROP POLICY IF EXISTS ticket_events_select ON public.ticket_events;
create policy ticket_events_select on public.ticket_events for select to authenticated
using (public.can_access_ticket(ticket_id) and (not internal or public.is_staff()));
DROP POLICY IF EXISTS ticket_events_insert ON public.ticket_events;
create policy ticket_events_insert on public.ticket_events for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_ticket(ticket_id)
  and (not internal or public.is_staff())
);

DROP POLICY IF EXISTS ticket_attachments_select ON public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
using (public.can_access_ticket(ticket_id));
DROP POLICY IF EXISTS ticket_attachments_insert ON public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
with check (uploaded_by = auth.uid() and public.can_access_ticket(ticket_id));
DROP POLICY IF EXISTS ticket_attachments_delete ON public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments for delete to authenticated
using (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-attachments','ticket-attachments',false,10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS ticket_files_select ON storage.objects;
create policy ticket_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and public.can_access_ticket(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS ticket_files_insert ON storage.objects;
create policy ticket_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and public.can_access_ticket(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS ticket_files_delete ON storage.objects;
create policy ticket_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'ticket-attachments' and public.is_staff());

DO $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

revoke all on public.departments, public.profiles, public.tickets, public.ticket_events, public.ticket_attachments from anon;
grant select on public.departments to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert on public.ticket_events to authenticated;
grant select, insert, delete on public.ticket_attachments to authenticated;
grant usage, select on sequence public.ticket_code_seq to authenticated;