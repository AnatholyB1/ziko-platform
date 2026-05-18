# Phase 27: Spike — Mandatory Plugin Pattern - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 27-Spike — Mandatory Plugin Pattern
**Areas discussed:** Enforcement approach, Spike output format, Auto-install trigger

---

## Enforcement Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Registry-driven (`manifest.mandatory: true`) | Add optional boolean to PluginManifest type in plugin-sdk. PluginLoader bypasses user_plugins for mandatory plugins. Store screen grays out trash button. Zero DB migration. | ✓ |
| Data-driven (`user_plugins.is_mandatory` column) | New DB column enforced at data layer via RLS or app check. More robust but requires migration + extra query complexity. | |

**User's choice:** Registry-driven

---

### PluginLoader loading strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Bypass user_plugins entirely | Mandatory plugins loaded unconditionally on every sign-in. No user_plugins row needed, no race condition on first install. | ✓ |
| Still check user_plugins, gate UI via manifest | user_plugins row still created; manifest flag only controls UI. Keeps data model consistent. | |

**User's choice:** Bypass user_plugins entirely

---

### Type system location

| Option | Description | Selected |
|--------|-------------|----------|
| Add to PluginManifest in plugin-sdk | `mandatory?: boolean` added to shared type. All 18 existing manifests compile cleanly (field is optional). | ✓ |
| Duck-type in PluginLoader only | Cast to `any` or use local extended type. Avoids shared package change but leaves field undocumented. | |

**User's choice:** Add to PluginManifest in plugin-sdk

---

## Spike Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| SPIKE.md + minimal working code | Decision record + applies minimal code changes (type, PluginLoader, button gate). Proves the pattern works. | ✓ |
| SPIKE.md doc only | Written analysis and files-to-touch list. No code written. "Local test" = described procedure. | |

**User's choice:** SPIKE.md + minimal code changes

---

### End-to-end confirmation bar

| Option | Description | Selected |
|--------|-------------|----------|
| Dev build visual confirmation | Run expo start, navigate to coach plugin detail, confirm trash icon grayed out and non-tappable. | ✓ |
| TypeScript compile only | Clean compile across all 18 manifests is sufficient. No dev build required. | |

**User's choice:** Dev build visual confirmation

---

## Auto-Install Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| PluginLoader on sign-in | Mandatory plugins registered via registerPlugin() unconditionally for any authenticated user. No user_plugins row, no extra query. | ✓ |
| authStore onAuthStateChange | Auth state change triggers upsert to user_plugins for client/both role users. | |
| Supabase trigger on user_profiles | PostgreSQL trigger inserts coach user_plugins row server-side when role = client/both. | |

**User's choice:** PluginLoader on sign-in

---

### Role gate

| Option | Description | Selected |
|--------|-------------|----------|
| All authenticated users (no role check) | Mandatory plugins load for everyone. Coaches see State A (no coach linked). No role query in PluginLoader. | ✓ |
| Only role = client \| both | Role check before loading. Coaches excluded. Requires extra user_profiles.role query. | |

**User's choice:** All authenticated users — no role check in PluginLoader

---

## Claude's Discretion

- SPIKE.md comparison table format — Claude chooses structure; must cover enforcement layer, DB migration required, code files touched, rollback path, pros/cons.

## Deferred Ideas

- Data-driven enforcement (is_mandatory column) — documented in SPIKE.md as rollback alternative; not implemented
- Role-gated loading — deferred; all users get mandatory plugins; State A handles no-coach cleanly
