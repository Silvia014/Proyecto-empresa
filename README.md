# Brasaland Platform

Brasaland's monorepo brings together the public restaurant website, the staff ERP, backend services, and data pipelines. Brasaland operates 14 restaurants across Colombia and Florida. The [company context](CONTEXT.md) explains the teams and business needs behind the platform.

## What has been built

| Area | Work in this repository |
| --- | --- |
| Public website and ordering | Bilingual restaurant site, menus, reservations, online orders, checkout, customer accounts, and Brasa Puntos loyalty. The React ordering app lives in [`restaurant-platform/ordering-app/`](restaurant-platform/ordering-app/). |
| Staff ERP | Next.js workspace for reservations, orders, customers, loyalty, locations, suppliers, inventory, recruiting, payroll, and rota. Recent changes corrected superadmin password re-verification, made the numbered module cards activate only on click or keyboard activation, and added the sales forecast chart to **View Business Dashboard**. |
| Backend and operations | FastAPI services, Supabase authentication and database migrations, and a standalone Node.js API for Hostinger. The ERP is also available via its [Vercel production login](https://proyecto-empresa-2l55.vercel.app/login). |
| Business reporting | Weekly location cost and waste pipeline, reporting endpoints, and operational incident analysis. The HR payroll and rota migration was applied and database permissions verified. The ERP's weekly cost and waste panel still needs a reachable reporting API. |
| Sales forecasting | Random Forest forecast for consolidated monthly sales, a seasonal baseline, a holdout backtest with a variability band, residual diagnostics, and a formal temporal evaluation before staging. |

## Sales forecast

The model uses the official [Brasaland sales history](data/raw/brasaland_sales.csv). The target is consolidated monthly sales in USD across all 14 locations. It learns year-over-year sales changes from calendar signals, earlier sales, and a rolling average. The holdout forecast was issued recursively from December 2023, using prior predictions wherever actual sales would have been unavailable.

| Holdout result | Value |
| --- | ---: |
| Training / test | 96 months (2016–2023) / 24 months (2024–2025) |
| Random Forest MAE | USD 36,578 per month |
| Seasonal baseline MAE | USD 48,254 per month |
| MAPE | 4.87% |
| MSE | 1,899,870,825 USD² |
| R² | 0.651 |
| PSI (training vs. test sales) | 2.241 |
| Normalized Gini | 0.881 |
| Variability band coverage | 58.3% (14 of 24 months) |
| D’Agostino–Pearson K² on test residuals | 0.4901 (p = 0.7827) |
| Mean residual (actual minus forecast) | −USD 31,462 per month |

The model reduced MAE by **24.2%** relative to the baseline, but it tended to overpredict and the historical P10–P90 band covered only 14 months. The K² test treats normality as the reference distribution. Its p-value is exploratory because the 24 monthly errors may be correlated. The PSI measures distribution shift between the two periods, and Gini measures how well the forecast ranks lower- and higher-sales months.

[Forecast chart](reports/sales_forecast/forecast.png) · [Full metrics](reports/sales_forecast/metrics.json) · [Monthly predictions](reports/sales_forecast/predictions.csv)

### Technical evaluation before staging

Five expanding-window folds within 2016–2023 used eight months of validation each. The evaluation recomputed lag and rolling features within each fold and kept 2024–2025 outside this diagnostic. The learning curve compares training and validation error at 24, 32, 40, 48, and 56 months of history.

| USD per month | Training mean ± SD | Validation mean ± SD |
| --- | ---: | ---: |
| MAE | 12,539 ± 3,223 | 22,192 ± 5,988 |
| RMSE | 15,357 ± 4,866 | 26,256 ± 7,094 |

MAE is the primary metric because Finance can use the average dollar miss to assess budgeting risk. RMSE highlights large misses that could disrupt purchasing around January's slowdown and December's peak.

The curve shows **signs of moderate overfitting**. Recursive forecast errors may also contribute to the training–validation gap. Before staging, compare a Random Forest with `max_depth=3` and `min_samples_leaf=6` against the current model on the same five folds.

[Technical report](data/eval/evaluation_report.md) · [Learning curve](data/eval/learning_curve.png) · [Scores by fold](data/eval/sales_cv_folds.csv)

### Reproduce the sales analysis

Use Python 3.11 or later and `uv` from the repository root.

```bash
uv sync --dev
uv run python scripts/evaluate_sales_forecast.py
uv run python -m scripts.evaluate_sales_learning_curve
uv run python -m pytest -q tests/pipelines/test_sales_forecast.py tests/pipelines/test_sales_temporal_cv.py
```

## Run the platform locally

The platform uses Docker Compose v2, Node.js and npm for frontend tooling, and Python with `uv` for backend and analysis tooling. Use [`.env.example`](.env.example) to identify configuration and keep secrets in your local environment.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

| Local port | Service |
| --- | --- |
| 3000 | Public website |
| 3001 | Staff backoffice |
| 8000 | Backend API |

Start Redis, the API, the worker, and Flower with `docker compose up --build -d redis api worker flower`. Stop the local stack with `docker compose down`.

For the production Docker configuration, use `docker compose --env-file .env.local -f docker-compose.prod.yml up -d --build`. Check status and logs with `docker compose -f docker-compose.prod.yml ps` and `docker compose -f docker-compose.prod.yml logs --tail=100`.

## Component documentation

| Area | Reference |
| --- | --- |
| User interfaces, staff ERP, and incident backoffice | [UI folders](uis/README.es.md) · [ERP](uis/talent-pipeline-tracker/README.md) · [Incident backoffice](uis/backoffice/README.md) |
| Backend and deployment | [Services](services/README.es.md) · [FastAPI](services/api/README.md) · [Hostinger API](hostinger-api/README.md) · [Infrastructure](infra/README.es.md) |
| Data and reporting | [Weekly cost and waste pipeline](data/pipelines/README.md) · [Raw data](data/raw/README.md) · [Processed data](data/process/README.md) · [Evaluation outputs](data/eval/README.md) · [Scripts](scripts/README.es.md) |
| Shared code and automation | [Packages](packages/README.es.md) · [Shared resources](shared/README.es.md) · [Workflows](workflows/README.es.md) · [MCPs](mcps/README.es.md) |
| Project documentation | [Docs](docs/README.es.md) · [Internal resources](internal/README.es.md) · [Audit](audit/AUDIT.md) · [Agent rules](AGENTS.md) |

For operational incident analysis, run `uv run python scripts/analyze.py scripts/incidents-brasaland.csv`.
