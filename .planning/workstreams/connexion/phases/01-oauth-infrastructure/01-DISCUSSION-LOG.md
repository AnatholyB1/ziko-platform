# Phase 1: OAuth Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 1-OAuth Infrastructure
**Areas discussed:** EAS build scope, Manual dashboard steps, Apple Developer access, Supabase project scope

---

## EAS build scope

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + Production only | Register the EAS-managed release keystore SHA-1 (shared preview/production). Avoids the volatile per-machine debug keystore SHA-1. | ✓ |
| Dev client local too | Add the local debug keystore SHA-1 now for immediate local testing — one more Google Cloud Console client entry. | |

**User's choice:** Preview + Production (Recommandé)
**Notes:** None — recommendation accepted as-is.

---

## Manual dashboard steps

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist séquencée avec checkpoints | Executor writes all code first, then stops at each blocking dashboard step with precise instructions and waits for confirmation. | ✓ |
| Code first, dashboard after | Executor writes everything with placeholder values, user handles dashboards afterward without interruption. | |

**User's choice:** Checklist séquencée avec checkpoints (Recommandé)
**Notes:** None.

---

## Apple Developer access

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, déjà actif | Paid Apple Developer Program account already exists — proceed directly to Services ID/Key creation. | ✓ |
| Non / je ne sais pas | Would need to verify/subscribe first — external blocker. | |

**User's choice:** Oui, déjà actif
**Notes:** None.

---

## Supabase project ciblé

| Option | Description | Selected |
|--------|-------------|----------|
| Projet production uniquement | Single Supabase project (`ziko` / `slkobhavpwsubnsmuhya`) — no separate staging project. | ✓ |
| Projet staging séparé | A second Supabase project needs configuring in parallel. | |

**User's choice:** Projet production uniquement (Recommandé)
**Notes:** None.

---

## Claude's Discretion

- Exact native SDK choice for Google Sign-In (library selection) — left to research/planning, informed by the dev-client-out-of-scope decision.

## Deferred Ideas

- Local dev-client OAuth support (debug keystore SHA-1) — fast-follow candidate if local testing friction becomes real.
- Separate Supabase staging project — not deferred to a phase, just flagged as a real gap; this phase's config changes will be tested carefully against production.
