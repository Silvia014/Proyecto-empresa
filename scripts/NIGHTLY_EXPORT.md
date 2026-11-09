# Nightly telemetry export

`nightly_export.py` is an independent CLI worker. It exports the prior UTC
calendar day from `public.telemetry_events` to `data/raw/telemetry_YYYY-MM-DD.csv`
and then starts the existing business ETL as a child process. The CSV is an
audit/recovery artifact; the ETL continues to read from PostgreSQL and does not
consume the CSV.

## Schedule

The GitHub Actions workflow `.github/workflows/nightly-telemetry-export.yml`
runs at **02:00 UTC every day** (`0 2 * * *`). GitHub Actions is the scheduler
because this repository's API is not a persistent worker host. The scheduled
job runs on a separate hosted runner, so it does not block FastAPI. The workflow
also supports a manual run with an optional `target_date` input.

Apply `supabase/migrations/20261109190000_create_job_runs.sql` to the target
database before the first scheduled run. The workflow becomes active when its
file is merged into the repository's default branch.

Set these repository Actions secrets before enabling the schedule:

- `DATABASE_URL` — compatibility fallback if separate URLs are not used.
- `SOURCE_DATABASE_URL` — read-only telemetry database connection.
- `REPORTING_DATABASE_URL` — database connection for the existing business ETL.
- `JOB_RUNS_DATABASE_URL` — connection allowed to read/write `public.job_runs`.

At minimum, configure the URL variables required by your environment. The
service resolves `JOB_RUNS_DATABASE_URL`, then `REPORTING_DATABASE_URL`, then
`DATABASE_URL` for orchestration state; source extraction resolves
`SOURCE_DATABASE_URL`, then `DATABASE_URL`.

## Run locally

From the repository root, with the required environment variables loaded:

```bash
PYTHONPATH=services/api uv run --python 3.12 python scripts/nightly_export.py
```

To test a specific day without changing code:

```bash
TARGET_DATE=2026-11-08 PYTHONPATH=services/api uv run --python 3.12 python scripts/nightly_export.py
```

or pass `--target-date 2026-11-08`. The date always represents a UTC calendar
day. The environment variable is useful for GitHub Actions manual runs.

## State, locking, and idempotency

`public.job_runs` is the orchestration ledger and is deliberately separate from
`reporting.pipeline_runs`, which audits the internal ETL stages. The unique
`(job_name, target_date)` index makes the run idempotent. A unique partial index
enforces at most one `processing` row per job name, so a run for a different
date cannot overlap. This enforces the same row-state lock and adds no separate
lock table, token, or flag. A `completed` date is skipped; a `failed` date may
be retried. The CSV is written to a temporary file and atomically renamed, and
an existing daily CSV is not overwritten.

The worker records start/end timestamps, final status, exported row count, and
an error summary. Caught failures transition the row to `failed` and are then
re-raised so the scheduler marks the run unsuccessful. A hard termination of
the runner or loss of database connectivity can prevent any application from
persisting a final state; ensure the scheduled runner is not force-cancelled.

The existing weekly pipeline chooses its own completed-week reporting window.
`TARGET_DATE` controls the CSV and idempotency key only; it does not change the
ETL's established business reporting semantics.

## Example log shape

```text
2026-11-09 02:00:00Z INFO job=nightly_export state=started target_date=2026-11-08 run_id=<uuid>
2026-11-09 02:00:02Z INFO job=nightly_export state=exported target_date=2026-11-08 run_id=<uuid> records=42 csv=data/raw/telemetry_2026-11-08.csv created=True
2026-11-09 02:00:03Z INFO job=nightly_export state=pipeline_started target_date=2026-11-08 run_id=<uuid>
2026-11-09 02:00:12Z INFO job=nightly_export state=completed target_date=2026-11-08 run_id=<uuid> records_processed=42
```

On failure the final line has `state=failed` and includes the captured error;
on a duplicate processing run it has `state=skipped ... reason=already_processing`.

## CSV shape

CSV headers are generated from the live `telemetry_events` columns. A sample
row is intentionally not committed because telemetry is real operational data.
