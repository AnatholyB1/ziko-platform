# Phase 2: RGPD Compliance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 02-rgpd-compliance
**Areas discussed:** Legal content & operator data, Deletion page UX, Rate limiting approach

---

## Legal Content & Operator Data

| Option | Description | Selected |
|--------|-------------|----------|
| Real data | SIRET, address, director name ready — final production copy goes in now | ✓ |
| Placeholder / template | Use [INSERT X] placeholders — structure is real, data filled in later | |

**User's choice:** Real data
**Notes:** Operator details provided: legal entity = "Ziko", director = "BRICON Anatholy". SIRET and physical address not yet available — use `[À COMPLÉTER]` placeholders.

---

## Legal Pages — i18n Scope

| Option | Description | Selected |
|--------|-------------|----------|
| French only | Legal obligations are French law — EN can defer or reuse FR text | ✓ |
| Both FR + EN | Translate legal content into English as well | |

**User's choice:** French only

---

## Deletion Page — URL

| Option | Description | Selected |
|--------|-------------|----------|
| /supprimer-mon-compte | Clean French URL, matches FR-default locale convention | ✓ |
| /account-deletion | English URL | |

**User's choice:** `/supprimer-mon-compte`

---

## Deletion Page — Confirmation Step

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — checkbox or typed confirmation | Friction before irreversible action | ✓ |
| No — email + submit only | Simpler, no friction | |

**User's choice:** Yes — with confirmation

---

## Deletion Page — Confirmation Type

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox | "Je comprends que cette action est irréversible" | |
| Type SUPPRIMER | User types the word SUPPRIMER to activate submit | ✓ |

**User's choice:** Type SUPPRIMER
**Notes:** Both the checkbox AND typing SUPPRIMER were captured as required (checkbox for acknowledgement, typed word to activate submit).

---

## Deletion Page — Footer Link

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add to footer | Visible on every page, better RGPD accessibility | ✓ |
| No — legal pages only | Link from Politique de confidentialité only | |

**User's choice:** Yes — add to footer

---

## Rate Limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Upstash Redis | Serverless Redis, free tier, persistent across deploys | ✓ |
| Vercel KV | Vercel managed KV (Redis), being deprecated in favour of Upstash | |
| In-memory | Zero deps but resets on every serverless invocation | |

**User's choice:** Upstash Redis

---

## Claude's Discretion

- Prose and structure of all three legal pages
- Styling of deletion page (follow established page pattern)
- Server Action vs API Route Handler for deletion (Server Action preferred)
- Error message wording for "not found" vs "rate limited"
