# CI/CD Design — Ziko Platform

**Date:** 2026-04-29  
**Status:** Approved

---

## Context

Ziko Platform is a Turborepo monorepo with three deployment targets:
- **Backend API** — Hono v4 on Vercel
- **Mobile app** — Expo SDK 54 via EAS Build (iOS + Android)
- **Database** — Supabase (PostgreSQL + RLS migrations)

No CI/CD existed before this. Deployment was fully manual (`vercel --prod --yes`, `eas build` from local).

---

## Goals

1. **Quality gate** — catch TypeScript errors and lint failures before they land on `main`
2. **Automated backend deploy** — every push to `main` deploys the API to Vercel
3. **Automated migrations** — Supabase migrations applied automatically when migration files change
4. **Automated mobile releases** — EAS builds and store submissions triggered by git tags

---

## Approach: 2 GitHub Actions Workflows

Chosen for simplicity. Covers all requirements without over-engineering.

---

## Workflow 1: `ci.yml` — triggered on push to `main`

### Jobs

```
push main
    │
    ├── quality                     (runs first)
    │     ├── npm ci
    │     ├── turbo type-check
    │     └── turbo lint
    │
    ├── deploy-backend              (needs: quality)
    │     └── vercel --prod --yes
    │
    └── migrate-supabase            (needs: quality)
          ├── only if: supabase/migrations/** changed
          └── supabase db push --linked
```

`deploy-backend` and `migrate-supabase` run in parallel after `quality` passes. No dependency between them — Vercel deploys code, Supabase applies schema changes independently.

### Required Secrets

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `SUPABASE_PROJECT_ID` | Project ref ID from Supabase dashboard |

Backend runtime environment variables (API keys, DB URL) are managed in the Vercel dashboard and inherited by the CLI deployment — no duplication needed in GitHub secrets.

---

## Workflow 2: `release.yml` — triggered on push of tags `v*` or `beta*`

### Jobs

```
push tag v* or beta*
    │
    ├── quality                     (same as ci.yml, safety net)
    │
    └── eas-build-submit            (needs: quality)
          │
          ├── if tag v*
          │     ├── eas build --profile production  (iOS + Android)
          │     └── eas submit --profile production → Play Store: production track
          │
          └── if tag beta*
                ├── eas build --profile preview     (Android APK)
                └── eas submit --profile production → Play Store: internal track
```

### Tag Convention

| Tag format | Example | EAS profile | Play Store track |
|------------|---------|-------------|-----------------|
| `v*` | `v1.5.0` | production | production |
| `beta*` | `beta1.5.0` | preview | internal |

iOS builds are included in `v*` tags. For iOS submit to App Store Connect, `APPLE_ID` and `ASC_APP_ID` must be added to EAS secrets — can be activated later.

### Required Secrets

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | EAS access token from expo.dev |

iOS/Android signing credentials (keystore, provisioning profiles) are managed by EAS cloud — no local credentials needed in GitHub.

---

## Secrets Summary

All secrets go in: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | Dashboard → Project Settings → General (ref ID) |
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens |

---

## Files to Create

```
.github/
  workflows/
    ci.yml       ← push to main
    release.yml  ← push tag v* or beta*
```

---

## Out of Scope

- iOS App Store submit (can be added later via EAS secrets)
- Staging environment / preview deployments per branch
- Turborepo remote cache (can be added later if CI is too slow)
- Test suite (no tests currently exist in the project)
