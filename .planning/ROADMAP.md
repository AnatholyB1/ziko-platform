# Roadmap: Ziko Platform

## Milestones

- ✅ **v1.0 Landing Page** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v1.1 Smart Pantry Plugin** — Phases 6–9 (shipped 2026-04-02)
- ✅ **v1.2 Barcode Enrichment + Tech Debt** — Phases 10–11 (shipped 2026-04-02)
- ✅ **v1.3 Security + Cloud Infrastructure** — Phases 12–16 (shipped 2026-04-05)
- ✅ **v1.4 Systeme de Credits IA & Monetisation** — Phases 17–21 (shipped 2026-04-29)

## Phases

<details>
<summary>✅ v1.0 Landing Page (Phases 1–5) — SHIPPED 2026-03-28</summary>

Five phases took the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installed the technical foundation — i18n routing, design tokens, and the static rendering architecture. Phase 2 shipped all RGPD and French legal requirements. Phase 3 built the three marketing sections. Phase 4 hardened SEO metadata. Phase 5 threw the switch: custom domain live, site public.

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-26
- [x] Phase 2: RGPD Compliance (3/3 plans) — completed 2026-03-26
- [x] Phase 3: Marketing Content (3/3 plans) — completed 2026-03-27
- [x] Phase 4: SEO + Performance (3/3 plans) — completed 2026-03-27
- [x] Phase 5: Launch (2/2 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v1.1 Smart Pantry Plugin (Phases 6–9) — SHIPPED 2026-04-02</summary>

Four phases added the Smart Pantry Plugin to the Ziko mobile app — a kitchen brain with inventory tracking, barcode scan for item lookup, AI macro-aware recipe suggestions, automatic calorie logging to the nutrition plugin, and a rule-based shopping list.

- [x] Phase 6: Smart Inventory (4/4 plans) — completed 2026-03-29
- [x] Phase 7: AI Recipe Suggestions (4/4 plans) — completed 2026-03-29
- [x] Phase 8: Calorie Tracker Sync (3/3 plans) — completed 2026-03-30
- [x] Phase 9: Smart Shopping List (3/3 plans) — completed 2026-04-01

</details>

<details>
<summary>✅ v1.2 Barcode Enrichment + Tech Debt (Phases 10–11) — SHIPPED 2026-04-02</summary>

Two phases enriched the nutrition plugin with Open Food Facts barcode scanning — users can scan any food product and see its Nutri-Score, Eco-Score, macros, and photo before logging. All v1.1 tech debt closed: SHOP-03 quantity prompt, AI tool registry migration, Nyquist VALIDATION.md audit.

- [x] Phase 10: Data Foundation + Tech Debt (3/3 plans) — completed 2026-04-02
- [x] Phase 11: Barcode UI + Score Display (3/3 plans) — completed 2026-04-02

</details>

<details>
<summary>✅ v1.3 Security + Cloud Infrastructure (Phases 12–16) — SHIPPED 2026-04-05</summary>

Five phases secured the Hono backend and added cloud storage infrastructure. Phase 12 provisioned Upstash Redis and added distributed rate limiting (IP + per-user). Phase 13 hardened the API with strict CORS, security headers, and Zod input validation. Phase 14 added Supabase Storage buckets with signed URL uploads. Phase 15 added lifecycle cron cleanup. Phase 16 fixed a middleware regression introduced by Phase 15. Full details in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

- [x] Phase 12: Infra + Rate Limiting (2/2 plans) — completed 2026-04-02
- [x] Phase 13: API Security Hardening (1/1 plans) — completed 2026-04-03
- [x] Phase 14: Supabase Storage (3/3 plans) — completed 2026-04-03
- [x] Phase 15: Lifecycle & Cleanup (1/1 plans) — completed 2026-04-05
- [x] Phase 16: Security Middleware Regression Fix (1/1 plans) — completed 2026-04-05

</details>

<details>
<summary>✅ v1.4 Systeme de Credits IA & Monetisation (Phases 17–21) — SHIPPED 2026-04-29</summary>

Five phases implemented a gamified AI credit system — atomic PostgreSQL credit deduction (SECURITY DEFINER RPC + SELECT FOR UPDATE), `creditService.ts` + `creditCheck`/`creditDeduct` Hono middleware, credit-gated AI routes with token telemetry, Haiku vision migration (~70% cost reduction), fire-and-forget earn hooks on 6 activity types, and a complete mobile credit UI (balance chip, earn toast, exhaustion bottom sheet, dual-balance card, cost labels). Full details in [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md).

- [x] Phase 17: DB Foundation + Model Fix (2/2 plans) — completed 2026-04-05
- [x] Phase 18: Credit Service + Middleware (2/2 plans) — completed 2026-04-05
- [x] Phase 19: Backend Routes + AI Integration (3/3 plans) — completed 2026-04-05
- [x] Phase 20: Activity Earn Hooks (2/2 plans) — completed 2026-04-09
- [x] Phase 21: Mobile UI — Credit Display + Exhaustion UX (2/2 plans) — completed 2026-04-09

</details>

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-26 |
| 2. RGPD Compliance | v1.0 | 3/3 | Complete | 2026-03-26 |
| 3. Marketing Content | v1.0 | 3/3 | Complete | 2026-03-27 |
| 4. SEO + Performance | v1.0 | 3/3 | Complete | 2026-03-27 |
| 5. Launch | v1.0 | 2/2 | Complete | 2026-03-28 |
| 6. Smart Inventory | v1.1 | 4/4 | Complete | 2026-03-29 |
| 7. AI Recipe Suggestions | v1.1 | 4/4 | Complete | 2026-03-29 |
| 8. Calorie Tracker Sync | v1.1 | 3/3 | Complete | 2026-03-30 |
| 9. Smart Shopping List | v1.1 | 3/3 | Complete | 2026-04-01 |
| 10. Data Foundation + Tech Debt | v1.2 | 3/3 | Complete | 2026-04-02 |
| 11. Barcode UI + Score Display | v1.2 | 3/3 | Complete | 2026-04-02 |
| 12. Infra + Rate Limiting | v1.3 | 2/2 | Complete | 2026-04-02 |
| 13. API Security Hardening | v1.3 | 1/1 | Complete | 2026-04-03 |
| 14. Supabase Storage | v1.3 | 3/3 | Complete | 2026-04-03 |
| 15. Lifecycle & Cleanup | v1.3 | 1/1 | Complete | 2026-04-05 |
| 16. Security Middleware Regression Fix | v1.3 | 1/1 | Complete | 2026-04-05 |
| 17. DB Foundation + Model Fix | v1.4 | 2/2 | Complete    | 2026-04-05 |
| 18. Credit Service + Middleware | v1.4 | 2/2 | Complete   | 2026-04-05 |
| 19. Backend Routes + AI Integration | v1.4 | 3/3 | Complete   | 2026-04-05 |
| 20. Activity Earn Hooks | v1.4 | 2/2 | Complete | 2026-04-09 |
| 21. Mobile UI — Credit Display + Exhaustion UX | v1.4 | 2/2 | Complete | 2026-04-09 |

---
*Roadmap created: 2026-03-26 — Milestone v1.0 Landing Page*
*Updated: 2026-04-29 — v1.4 archived: Systeme de Credits IA & Monetisation (Phases 17–21)*
