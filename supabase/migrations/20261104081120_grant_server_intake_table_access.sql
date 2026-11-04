-- Public intake writes and the staff API use the server-only service role.
-- RLS remains enabled; no anon or authenticated table access is granted.
GRANT SELECT, INSERT, UPDATE ON TABLE public.candidate_applications TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reservations TO service_role;
