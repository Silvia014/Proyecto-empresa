# Brasaland Platform

This repository contains the Brasaland restaurant platform: a public static website, an internal staff backoffice, a FastAPI backend, and supporting scripts/data for the company’s digital operations.

The project is currently in a hybrid state: the public site is mostly static HTML/CSS/JS, the backoffice is a Next.js app under `uis/talent-pipeline-tracker`, and the backend exposes Python services for data and API functionality.

---

## What is in this repository

### Public website
The root of the repo contains the customer-facing website files such as:

- `index.html`
- `account.html`, `account.js`, `account.css`
- `checkout.html`, `checkout.js`, `checkout.css`
- `order.html`, `order.js`, `order.css`
- `reserva.html`, `reserva.js`
- `candidate-*` pages and related assets
- `chat.js` and `validation.js` used by the public frontend

This is a traditional static site with JS-driven interaction and form validation.

### Internal backoffice
The staff-facing app is under:

- `uis/talent-pipeline-tracker/`

It is a Next.js + React application with App Router pages such as:

- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/dashboard/`
- `app/account/`
- `app/profile/`

The app uses Tailwind styling and Supabase client authentication.

### API and backend
The backend is split between:

- `api/` — serverless-style JS/TS endpoint files for account, reservation, and chat functionality
- `services/api/` — FastAPI application and supporting backend code

The Python backend includes dependencies for:

- FastAPI
- SQLModel
- Pydantic
- Python-Jose
- Resend
- Alembic
- Uvicorn

### Data and analysis tools
This repo also includes:

- `scripts/analyze.py` for CSV incident analysis
- `data/` with raw/process/evaluation folders
- `results.csv` and `scripts/incidents-brasaland.csv` for analysis/testing workflows
- `audit/` for Lighthouse and performance reports

---

## Current stack

### Frontend and static site
- HTML / CSS / JavaScript
- Tailwind CSS
- Playwright and Lighthouse for QA/audits
- Supabase JS client

### Backoffice
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth client

### Backend
- Python 3
- FastAPI
- SQLModel / Pydantic
- Alembic for migrations
- Uvicorn

### Deployment and tooling
- Docker Compose
- Dockerfiles under `uis/` and `services/`
- `package.json` for frontend tooling and Lighthouse checks
- `pyproject.toml` for Python environment and scripts

---

## Repository structure

```text
.
├── AGENTS.md
├── CONTEXT.md
├── README.md
├── package.json
├── pyproject.toml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .env.local
├── index.html
├── styles.css
├── main.js
├── validation.js
├── translations.js
├── chat.js
├── api/
├── audit/
├── data/
├── docs/
├── infra/
├── internal/
├── mcps/
├── packages/
├── scripts/
├── services/
├── shared/
├── skills/
├── uis/
├── workflows/
├── tests/
├── memory-bank/
└── src/
```

---

## Local development

### Prerequisites

- Docker and Docker Compose v2
- Node.js and npm
- Python 3.9+
- Access to the project environment variables in `.env.local`

### Start the stack

```bash
docker compose up -d --build
```

### Check containers

```bash
docker compose ps
```

### View logs

```bash
docker compose logs -f
```

### Stop the stack

```bash
docker compose down
```

---

## Production deployment

```bash
docker compose --env-file .env.local -f docker-compose.prod.yml up -d --build
```

Then check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

And inspect logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100
```

---

## Ports

The current Docker setup exposes:

- `3000` — public website / static frontend
- `3001` — backoffice frontend
- `8000` — backend API service

---

## Important project notes

- The website and backoffice are intentionally separated, but the repo still contains the older root-level static site while the monorepo migration is in progress.
- Sensitive configuration values are expected in `.env.local` and should not be committed to Git.
- The root `CONTEXT.md` contains the main Brasaland business context and operational brief.
- The codebase includes both business app work and research/analysis tooling, so the repo is not a single app but a platform containing multiple web and backend artifacts.

---

## Scripts and analysis examples

The repo includes CSV analysis tooling, including:

```bash
python scripts/analyze.py scripts/incidents-brasaland.csv
```

This is part of the operational validation flow that checks incident records, invalid entries, and satisfaction metrics.

---

## Overall goal

The repository is building a modern restaurant platform for Brasaland with:

- public customer-facing experiences
- internal operations tooling
- API and data services
- AI and automation support
- incremental migration toward a monorepo structure

---

## Useful references

- [CONTEXT.md](CONTEXT.md)
- [AGENTS.md](AGENTS.md)
- [audit/AUDIT.md](audit/AUDIT.md)
- [uis/README.es.md](uis/README.es.md)
- [services/README.es.md](services/README.es.md)
- [scripts/README.es.md](scripts/README.es.md)
