-- CHAMADO T.I. 3.0 — promover o primeiro usuário a Administrador
-- 1) Crie o usuário pelo painel Authentication > Users do Supabase.
-- 2) Troque SEU_EMAIL_ADMIN abaixo pelo e-mail desse usuário.
-- 3) Execute este SQL uma única vez.

update public.profiles p
set
  role = 'admin',
  department_id = (select id from public.departments where name = 'Administração' limit 1),
  active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('SEU_EMAIL_ADMIN');

-- Conferência
select p.id, u.email, p.full_name, p.role, d.name as department, p.active
from public.profiles p
join auth.users u on u.id = p.id
left join public.departments d on d.id = p.department_id
where lower(u.email) = lower('SEU_EMAIL_ADMIN');