# AGENTS.md

## Purpose

This repository contains the BRASALAND restaurant platform.

Agents working in this repository must preserve existing functionality while
making changes, especially during architectural migration.

The repository is progressively moving toward a monorepo architecture with
separate public website, internal applications and backend services.

---

## Required Context at Session Start

Before making any code or architectural change, the agent must read:

1. `memory-bank/projectbrief.md`
2. `memory-bank/techContext.md`
3. `memory-bank/progress.md`

If any required file in `memory-bank/` is missing or unreadable, do not
abort; note the missing file, proceed by inspecting the repository directly,
and report the gap to the user.

The agent must use these files to understand:

- The business purpose of the project.
- The current technical architecture.
- Existing constraints.
- Current development status.
- Known future work.

If any of these files conflict with the actual repository implementation,
the agent must inspect the repository before making assumptions.

---

## Required Workflow Before Every Commit

The agent must follow these steps in order before creating a commit:

### 1. Read context

Read the required files in `memory-bank/`.

### 2. Inspect

Inspect the existing implementation related to the requested change.

Identify:

- Relevant files.
- Dependencies.
- API routes.
- Imports.
- Relative paths.
- Environment variables.
- Deployment implications.
- Existing functionality that could be affected.

### 3. Plan

For any change touching more than one file, adding a dependency, or modifying
an API route, first define the smallest safe implementation that satisfies the
request.

Avoid unrelated refactoring.

### 4. Implement

Make only the changes required for the requested task.

Preserve existing behaviour unless the task explicitly requires changing it.

### 5. Test

Run the appropriate tests, checks or local verification for the affected
functionality.

If any test or check fails, stop the workflow, do not create a commit, and
either fix the failure or report it to the user with the failing output.

If no automated test exists, run the affected code path via the CLI or a
temporary script, and report the exact command and output used.

### 6. Review

Run:

```bash
git status
git diff
```

Review the diff to confirm it contains only intended changes and no unrelated
edits, secrets, or debug output.

Only then create the commit with a message describing the change.