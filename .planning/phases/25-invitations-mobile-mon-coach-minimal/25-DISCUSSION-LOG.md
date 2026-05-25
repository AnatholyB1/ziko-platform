# Phase 25: Invitations & Mobile "Mon coach" Minimal — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `25-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 25-invitations-mobile-mon-coach-minimal
**Areas discussed:** Mobile "Mon coach" placement; Web invitations UI; Code entry & coach preview; Revoke flows (both sides)

---

## Mobile "Mon coach" placement

### Q1 — Where should the 'Mon coach' screen live in the mobile app?

| Option | Description | Selected |
|--------|-------------|----------|
| New top-level tab | Add a 'Coach' tab; always visible to client-role users. Mirrors Strava/Trainerize. | |
| Inside Profile screen | Add a 'Mon coach' card/row on `/(app)/profile`. Lower discoverability. | |
| Inside Settings | Add a 'Mon coach' section to `/(app)/settings.tsx`. Most discreet. | |
| Dedicated screen + Profile entry | Full-screen at `/(app)/coach`. Hybrid. | |
| **Other (freeform)** | — | ✓ |

**User's choice:** "un nouveau plugin avec sa propre page, pour le design on va passer par claude design tu me donneras le prompt complet pour le créer"
**Notes:** User pivots to building a new plugin (matching the 17 existing plugins). Design via Claude Design — full prompt to be provided at the end of the workflow.

### Q2 — Should the 'Mon coach' surface appear for ALL client-role users, or only after some signal?

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Empty state (code-entry CTA) to every client-role user. Matches SC2. | ✓ |
| Hidden behind a 'Have a coach?' toggle | Only show after explicit opt-in. | |
| Visible only if a flag is set in user_profiles | Most complex. | |

**User's choice:** Always visible (Recommended)
**Notes:** Maximizes coach-redemption funnel.

### Q3 — Plugin id / display name?

| Option | Description | Selected |
|--------|-------------|----------|
| `coach` / 'Mon coach' | Short, clean. | |
| `mon-coach` / 'Mon coach' | Explicit French id. | |
| `coach-link` / 'Mon coach' | Disambiguates from coach role. | |
| **Other (freeform)** | — | ✓ |

**User's choice:** "enregistre le plugin coach et la partie app mobile comme une seed gsd pour le prochain milestone"
**Notes:** Pivot — the entire mobile plugin work is deferred to v1.6 as a GSD seed. Phase 25 will ship zero mobile code.

### Q4 — Should the plugin route appear in the bottom tab bar by default?

| Option | Description | Selected |
|--------|-------------|----------|
| Always in tab bar | `showInTabBar: true`. | |
| Only in `/modules` listing, accessed via Profile | Less prominent. | |
| Tab bar only when a coach is linked | Conditional — not a current pattern. | |
| **Other (freeform)** | — | ✓ |

**User's choice:** "plugin déjà préinstallé et pas desinstalable"
**Notes:** Plugin must be pre-installed AND non-uninstallable for client-role users. Captured as seed contract for v1.6.

### Scope-reconciliation questions (after the mobile-defer pivot)

#### Q5 — How do we close the redemption loop in Phase 25?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend RPC + minimal web redeem page | `POST /coach/clients/links/redeem` + `/r/[code]` + `/redeem` on apps/web. | ✓ |
| Backend RPC only, no UI for redemption | Dormant codes until v1.6. | |
| Keep mobile MINIMAL in Phase 25 + defer polish | Barebones mobile screen now. | |

**User's choice:** Backend RPC + minimal web redeem page (Recommended)

#### Q6 — Is the seed the FULL mobile plugin or just polish?

| Option | Description | Selected |
|--------|-------------|----------|
| Full plugin from scratch in v1.6 | Phase 25 ships zero mobile code. | ✓ |
| Polish-only seed (Phase 25 ships minimal mobile) | — | |

**User's choice:** Full plugin from scratch in v1.6 (Recommended)

---

## Web invitations UI (coach side)

### Q7 — Where should the coach generate/manage invitation codes on the web?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `/coach/invitations` route | Unlock sidebar "Invitations" placeholder. Best for v1.6+ growth. | ✓ |
| Section inside `/coach/dashboard` | Card with generate CTA + last 5 codes. | |
| Modal triggered from dashboard CTA | Lightweight but loses URL state. | |

**User's choice:** Dedicated `/coach/invitations` route (Recommended)

### Q8 — What expiration UX should the generate form use?

| Option | Description | Selected |
|--------|-------------|----------|
| Preset chips: 7d / 14d (default) / 30d / Never | Fastest path. | ✓ |
| Date picker only | More flexibility, more clicks. | |
| Preset chips + 'Custom date' option | Best of both, slightly more code. | |

**User's choice:** Preset chips: 7d / 14d (default) / 30d / Never (Recommended)

### Q9 — How should a freshly generated code be presented for sharing?

| Option | Description | Selected |
|--------|-------------|----------|
| Big mono code + copy button + share link | Code + clipboard + share URL to `/r/[code]`. | ✓ |
| Code + copy button only | Simplest, loses deep-link funnel. | |
| Code + share URL + QR code | Adds QR lib dependency. | |

**User's choice:** Big monospaced code + copy button + share link (Recommended)

---

## Code entry & coach preview (web)

### Q10 — Athlete-facing redeem URL shape?

| Option | Description | Selected |
|--------|-------------|----------|
| `/r/[code]` short link + `/redeem` manual entry | Two paths, one page. Best funnel. | ✓ |
| `/redeem?code=XXX` only | Single page, uglier shared URL. | |
| `/[locale]/redeem` only (manual entry) | Always-manual flow. | |

**User's choice:** `/r/[code]` short link + `/redeem` manual entry (Recommended)

### Q11 — Login gate timing?

| Option | Description | Selected |
|--------|-------------|----------|
| Login required before preview | Unauthenticated visitor redirected to `/fr/login?next=...`. Prevents preview leaks. | ✓ |
| Preview shown to anyone, login required only on confirm | Better funnel but exposes coach profiles. | |
| Open code entry to anyone (no preview before login) | Worst UX. | |

**User's choice:** Login required before preview (Recommended)

### Q12 — Coach preview screen contents + CTA copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Photo + display_name + specialties chips + bio + KYC badge — CTA 'Lier mon compte' | Full card with trust signals. | ✓ |
| Minimal: photo + display_name only — CTA 'Accepter ce coach' | Strips trust signals. | |
| Photo + display_name + bio + specialties (no KYC) — CTA 'Confirmer' | Hides KYC. | |

**User's choice:** Photo + display_name + specialties chips + bio + KYC badge — CTA 'Lier mon compte' (Recommended)

### Q13 — Input pattern for manual code entry at `/redeem`?

| Option | Description | Selected |
|--------|-------------|----------|
| Single text input, auto-uppercase, filter `[A-Z2-9]`, max 6 chars | Paste-friendly, dead simple. | ✓ |
| Six segmented inputs (like 2FA code) | Visually distinctive but paste-handling finicky. | |
| Single input with format mask | Mask handling adds edge cases. | |

**User's choice:** Single text input, auto-uppercase, filter `[A-Z2-9]`, max 6 chars (Recommended)

---

## Revoke flows (both sides)

### Q14 — Where does the athlete revoke an active coach link in Phase 25?

| Option | Description | Selected |
|--------|-------------|----------|
| Same `/redeem` page becomes state-aware | Three states on one URL: no-code / preview / linked. | ✓ |
| Athlete revoke fully deferred to v1.6 seed | Leaves athletes stuck if they regret sharing a code. | |
| Dedicated `/mon-coach` page on web | Two URLs split by purpose. | |

**User's choice:** Same `/redeem` page becomes state-aware (Recommended)

### Q15 — What confirmation pattern for the 2-step revoke (SC5)?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with 'Type COACH to confirm' | Two-step typed confirmation. Symmetric for both sides. | ✓ |
| Modal with red 'Confirmer la révocation' button | Easier to misclick. | |
| Reveal-then-confirm inline (no modal) | Mobile-friendly but typed pattern more deliberate. | |

**User's choice:** Modal with 'Type COACH to confirm' (Recommended)

### Q16 — After revoke, what's the visibility of the revoked record?

| Option | Description | Selected |
|--------|-------------|----------|
| Coach sees revoked invitations in list with grey 'Révoqué' chip (filter to hide) | Audit trail kept, default filter hides. | ✓ |
| Revoked invitations hidden by default, no toggle | Loses visual confirmation. | |
| Revoked invitations visible always, no filter | Table grows noisy. | |

**User's choice:** Coach sees revoked invitations in list with grey 'Révoqué' chip (filter to hide) (Recommended)

---

## Closing question

### Q17 — Anything else before writing CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md + DISCUSSION-LOG.md + capture v1.6 seed. | |
| Explore more gray areas | Backend module split, Upstash middleware location, REST vs Server Action, etc. | |
| **Other (freeform)** | — | ✓ |

**User's choice:** "le design doit etre fait sur claude design avant l'execution phase de gsd, note, le design pour les précédentes phases avec de l'ui n'ont pas été fait donc on doit le rattraper et le faire maintenant. il faudrait que ca soit automatiquement le cas pour toutes les prochaines utilisation de gsd quand ca implique un livrable visuel"
**Notes:** Three additional decisions captured:
1. UI-design-first gate for Phase 25 — `/gsd-ui-phase 25` must run before `/gsd-plan-phase 25`.
2. Retroactive UI design catch-up for Phases shipped without `/gsd-ui-phase` (notably Phase 24 surfaces) — seeded for v1.6.
3. Make UI-design-first automatic for all future GSD phases with a visual deliverable — verify `workflow.ui_phase` + `workflow.ui_safety_gate` flags enforce the gate; seeded for v1.6.

---

## Claude's Discretion

- Tailwind / CSS class structure (matches Phase 24 styling).
- Generate panel: in-page collapsible vs slide-over (Figma decides).
- Filter chip component reuse from Phase 24 vs build thin.
- Server Actions vs `useFormState` + REST (match Phase 24 pattern).
- Error envelope wire format (`{ ok, error_code }` vs HTTP status + body).
- `peek_invitation` as a new SQL function vs `dry_run` flag on existing RPC.

## Deferred Ideas

- v1.6 SEED — full mobile "Mon coach" plugin (pre-installed, non-uninstallable, design baked in).
- v1.6 BACKLOG — retroactive UI design for Phase 24 surfaces (onboarding, dashboard, settings, login).
- v1.6 CONFIG — verify / harden `workflow.ui_phase` enforcement.
- Bulk invitations / pre-fill emails — post-v1.5.
- Coach analytics dashboard — v1.6+.
- QR codes — v1.6+.
- Coach revoking an *active link* (not just code) — Phase 26.
- Audit log column on `coach_client_links` — Phase 26 / post-v1.5.
