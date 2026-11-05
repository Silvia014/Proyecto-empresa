-- Staff-only ERP access and server-managed role assignments.
create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in (
    'superadmin', 'admin', 'manager_hr', 'marketing', 'economato', 'chef', 'staff'
  )),
  display_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_superadmin_email_check
    check (role <> 'superadmin' or lower(email) = 'roldansilvi@gmail.com')
);

create unique index if not exists staff_profiles_single_superadmin
  on public.staff_profiles (role)
  where role = 'superadmin';

alter table public.staff_profiles enable row level security;
revoke all on table public.staff_profiles from anon, authenticated;
grant select on table public.staff_profiles to authenticated;
grant all on table public.staff_profiles to service_role;

drop policy if exists "Staff can read their own profile" on public.staff_profiles;
create policy "Staff can read their own profile"
  on public.staff_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- The known owner is the sole superadmin. This is a no-op if the Auth user
-- has not been provisioned in the target project yet; the server bootstrap
-- endpoint will insert the profile after authenticating that email.
insert into public.staff_profiles (user_id, email, role, display_name)
select id, lower(email), 'superadmin', coalesce(raw_user_meta_data ->> 'name', 'Silvia Guerra')
from auth.users
where lower(email) = 'roldansilvi@gmail.com'
on conflict (user_id) do update
set email = excluded.email,
    role = 'superadmin',
    updated_at = now();
