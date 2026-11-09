-- These tables are accessed by trusted server-side services only.
-- Keep browser roles out; the API routes use service_role and the legacy
-- FastAPI/Alembic connection uses the database owner role.
ALTER TABLE public.supplier_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.supplier_directory, public.incidents, public.alembic_version
  FROM PUBLIC, anon, authenticated;

-- The CRM supplier and inventory routes query this table with the server-only
-- service_role key. RLS is bypassed by service_role, but SQL privileges are
-- still required.
GRANT SELECT ON TABLE public.supplier_directory TO service_role;

-- This SECURITY DEFINER function is a trigger handler, not a client RPC.
-- Trigger execution does not require callers to have EXECUTE privilege.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
