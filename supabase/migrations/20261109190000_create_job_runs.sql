-- Nightly orchestration state is separate from reporting.pipeline_runs,
-- which records the internal stages of the business ETL itself.
CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    target_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    records_processed INTEGER NOT NULL DEFAULT 0 CHECK (records_processed >= 0),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This unique index is also the efficient lookup and idempotency key for a
-- given daily job. The processing row is the only distributed lock.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_runs_job_name_target_date
    ON public.job_runs (job_name, target_date);

-- The processing row is also a global per-job lock, so different target dates
-- cannot run concurrently. This constraint enforces the same state lock; it
-- does not introduce another lock table, token, or flag.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_runs_one_processing_per_job
    ON public.job_runs (job_name)
    WHERE status = 'processing';

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.job_runs TO service_role;
