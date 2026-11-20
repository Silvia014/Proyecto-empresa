-- The staff routes authorize the caller before using the server role.
GRANT DELETE ON TABLE public.candidate_applications, public.reservations TO service_role;
