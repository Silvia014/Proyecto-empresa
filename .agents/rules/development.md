# Brasaland Development Rule

## Scope

This rule applies to all development work inside this monorepo, especially changes affecting:

- `uis/website`
- `uis/backoffice`
- `services/`
- `shared/`
- Supabase-related backend logic
- Brasaland business workflows

## Rules

1. Read `CONTEXT.md` and the relevant files in `memory-bank/` before making architectural changes.

2. Keep the public website and internal backoffice separated:
   - Public application: `uis/website`
   - Internal application: `uis/backoffice`

3. Backend services must be implemented under `services/` following the existing service conventions.

4. Reuse shared logic through `shared/` when appropriate instead of duplicating business logic between applications.

5. Do not expose secrets, API keys, Supabase service-role credentials, or other private configuration in frontend code.

6. Before committing, run the validation and review workflow defined in the root `AGENTS.md`.

7. Do not modify protected infrastructure, deployment configuration, or existing production integrations without explicit developer confirmation.