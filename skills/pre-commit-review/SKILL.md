# Pre-Commit Review

## Purpose

Review repository changes before a commit to ensure that the changes are
relevant, safe, complete, and consistent with the requested task.

This skill does not create commits or push changes.

## When to Use

Use this skill before committing a meaningful code or architectural change.

It is especially important after:

- Architectural changes
- File moves or renames
- API changes
- Database changes
- Authentication changes
- Deployment/configuration changes
- Changes affecting multiple applications or services

## Procedure

### 1. Inspect Git status

Run:

```bash
git status