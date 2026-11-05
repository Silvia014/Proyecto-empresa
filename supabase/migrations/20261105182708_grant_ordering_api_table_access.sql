-- The Hostinger ordering API uses the service_role key. Supabase service_role
-- bypasses row-level security, but still needs table privileges if grants have
-- been restricted on the ERP tables.
grant select on table public."Location", public."MenuItem" to service_role;
grant select, insert, update on table public."Customer" to service_role;
grant select, insert, update on table public."Order" to service_role;
grant select, insert, update on table public."OrderItem" to service_role;

grant execute on function public.ensure_brasaland_customer(text, text, text, text, text, text, boolean)
  to service_role;
