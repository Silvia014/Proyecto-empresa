# Weekly Location Cost & Waste Pipeline

This folder contains the weekly business-performance pipeline for Brasaland.

## Purpose and KPIs

The flow produces one row per location and ISO week in \`reporting.weekly_location_performance\`:

| KPI | Source / calculation |
|---|---|
| Purchase cost | Sum \`total_cost\` from \`inbound_order_created\` |
| Waste cost | Sum \`total_cost\` from \`stock_waste_registered\` |
| Waste ratio | Waste cost / purchase cost; zero when purchase cost is zero |
| Stockout frequency | Count \`stock_threshold_triggered\` |
| Price-alert frequency | Count \`ingredient_price_variance_detected\` |

Monetary values remain in local currency (COP or USD) and are never combined across currencies.

## Sources and destinations

- Read-only sources: \`public.telemetry_events\` and \`public."Location"\`.
- KPI destination: \`reporting.weekly_location_performance\`, unique on \`(location_id, week_start)\`.
- Execution audit: \`reporting.pipeline_runs\`.
- Local quality snapshots: \`data/eval/pipeline-<run_id>.json\`.

The technical telemetry analysis and \`GET /telemetry/report\` remain separate and unchanged.

The independent nightly export wrapper, its `job_runs` orchestration ledger,
and its external schedule are documented in the [nightly export guide](../../scripts/NIGHTLY_EXPORT.md).

## Cadence and execution

Business cadence is weekly, every Monday at 07:00 \`America/Bogota\` (12:00 UTC). The active scheduler is GitHub Actions in `.github/workflows/weekly-business-report.yml`; it runs the pipeline and sends the KPI report through Resend. The Prefect deployment schedule is disabled to avoid duplicate scheduled runs.

Run locally from the repository root:

\`\`\`bash
PYTHONPATH=services/api uv run --python 3.12 python data/pipelines/pipeline.py
\`\`\`

Run a specific week or historical backfill:

\`\`\`bash
PYTHONPATH=services/api uv run --python 3.12 python - <<'PY'
from data.pipelines.pipeline import weekly_location_cost_waste_flow
weekly_location_cost_waste_flow(
    week_start="2026-11-02",
    trigger_source="backfill",
)
PY
\`\`\`

The default run processes the last completed week and re-extracts the requested week plus the previous three weeks (28-day correction window) for late-arriving events. Destination upserts are idempotent on location/week.

## Data-quality behavior

- \`outbound_order_created\` is contextual only and is not included in KPI calculations.
- Events with \`demo_record=true\` are skipped and logged as warnings.
- The canonical country and currency come from the \`Location\` reference row. Missing event-level metadata is accepted; conflicting metadata is rejected.
- Unknown locations are rejected; no numeric or legacy identifier is guessed.
- An invalid cost or conflicting metadata blocks publication only for the known location/week. Other unaffected location/week rows can still load.
- Runs with rejected events finish as \`partial\` and include error details in \`reporting.pipeline_runs\`. Clean runs finish as \`completed\`; infrastructure errors finish as \`failed\`.
- Source telemetry is never updated or deleted.

## Reporting API

The authenticated \`services/reporting\` router exposes:

- \`GET /reporting/pipeline-runs/latest\`
- \`POST /reporting/pipeline-runs\` (body may include a Monday \`week_start\`; returns 202 and starts a background run)
- \`GET /reporting/weekly-location-performance\` (optional \`week_start\`, \`location_id\`, \`country\`, \`limit\`; defaults to the latest published week)

All endpoints use the same Supabase bearer-token validation as the inventory API.

## Prefect deployment

A deployment definition is in the repository root \`prefect.yaml\`. After configuring Prefect credentials and creating a worker/work pool, deploy with:

\`\`\`bash
uv run prefect deploy --all
\`\`\`

The Monday schedule runs from GitHub Actions after this workflow is merged into the repository's default branch. Configure the Actions secrets `DATABASE_URL` or both `SOURCE_DATABASE_URL` and `REPORTING_DATABASE_URL`, plus `RESEND_API_KEY`. The workflow uses `Brasaland <reservas@brasaland.site>` as the sender and `roldansilvi@gmail.com` as the recipient. Set `SEND_WEEKLY_REPORT_EMAIL=true` only in this weekly workflow; ordinary pipeline and nightly-export runs do not send duplicate emails. GitHub scheduled runs can start a few minutes after the cron time during periods of high load.

## Install and lock dependencies

The Prefect 3 runtime is declared in the root project and API requirements. After pulling this branch, regenerate the lockfile and sync the environment:

```bash
uv lock
uv sync --python 3.12 --dev
```

## Verification

\`\`\`bash
PYTHONPATH=services/api uv run --python 3.12 python -m compileall -q data services
PYTHONPATH=services/api uv run --python 3.12 pytest -q
\`\`\`

Before production, use a least-privilege database role for the \`reporting\` schema and keep database/Prefect credentials in environment variables or Prefect blocks, never in source control.
