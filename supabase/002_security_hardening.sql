-- CHAMADO T.I. 3.0 — hardening de acesso
-- Execute logo após schema.sql.

alter table public.profiles alter column active set default false;

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
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_profile_active() and exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and (t.requester_id = auth.uid() or public.is_staff())
  );
$$;

DROP POLICY IF EXISTS departments_select_authenticated ON public.departments;
create policy departments_select_authenticated on public.departments for select to authenticated
using (public.current_profile_active());

DROP POLICY IF EXISTS departments_admin_insert ON public.departments;
create policy departments_admin_insert on public.departments for insert to authenticated
with check (public.current_profile_active() and public.is_admin());

DROP POLICY IF EXISTS departments_admin_update ON public.departments;
create policy departments_admin_update on public.departments for update to authenticated
using (public.current_profile_active() and public.is_admin())
with check (public.current_profile_active() and public.is_admin());

DROP POLICY IF EXISTS profiles_select ON public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (public.current_profile_active() and (public.is_staff() or role in ('technician','admin')))
);

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.current_profile_active() and public.is_admin())
with check (public.current_profile_active() and public.is_admin());

DROP POLICY IF EXISTS tickets_select ON public.tickets;
create policy tickets_select on public.tickets for select to authenticated
using (public.current_profile_active() and (requester_id = auth.uid() or public.is_staff()));

DROP POLICY IF EXISTS tickets_staff_update ON public.tickets;
create policy tickets_staff_update on public.tickets for update to authenticated
using (public.current_profile_active() and public.is_staff())
with check (public.current_profile_active() and public.is_staff());