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

## Cadence and execution

Business cadence is weekly, every Monday morning. The proposed time is 07:00 \`America/Bogota\`; this schedule is configured inactive until the business owner confirms the time and a Prefect work pool/worker is provisioned.

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

The configured Monday schedule remains inactive until its timezone/time and production worker are approved. Prefect schedules create scheduled flow runs; a running worker is required to execute them.

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
