-- Customer portal suggestions and complaints, linked to the same Customer profile used by the ERP.
create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public."Customer" (id) on delete cascade,
  category text not null check (category in ('suggestion', 'complaint')),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_messages_customer_created_idx
  on public.customer_messages (customer_id, created_at desc);

alter table public.customer_messages enable row level security;
revoke all on table public.customer_messages from public, anon, authenticated;
grant all on table public.customer_messages to service_role;
