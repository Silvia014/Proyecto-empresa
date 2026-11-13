CREATE TABLE IF NOT EXISTS public.celery_dead_letters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL UNIQUE,
  task_name text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  error_message text NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS celery_dead_letters_failed_at_idx
  ON public.celery_dead_letters (failed_at DESC);

ALTER TABLE public.celery_dead_letters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.celery_dead_letters
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.celery_dead_letters TO service_role;