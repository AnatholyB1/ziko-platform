---
phase: 31
slug: public-marketing-coachs
created: 2026-05-22
status: pending
---

# Phase 31 — Validation Strategy: Public Marketing /coachs

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Not applicable — pure static page (no Vitest/Playwright tests) |
| Quick run | `cd apps/web && npm run type-check` |
| Build smoke | `cd apps/web && npm run build` (SSG — both /fr/coachs + /en/coachs must appear in output) |
| Full suite | `cd apps/web && npm run build && npm run type-check` |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| MKT-01 | `/coachs` (FR) and `/en/coachs` (EN) render without error, with hero, feature blocks, FAQ, footer | Build smoke | `npm run build` — routes appear in SSG static output, no build error | Build fails if page errors |
| MKT-02 | "Rejoindre la bêta privée" CTA links to `/{locale}/coach/onboarding` | Code + manual | `grep -r "coach/onboarding" apps/web/src/components/marketing/CoachsHero.tsx apps/web/src/components/marketing/CoachsCtaFooter.tsx` | Must appear in both Hero and CTA footer |
| MKT-03 | Video placeholder section exists in DOM (real video deferred per D-05) | Code + manual | `grep -r "CoachsVideoPlaceholder" apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` | Section must be rendered; real video is a future swap |
| MKT-04 | Comparison table vs Trainerize / TrueCoach — 3 rows, Ziko highlighted | Code + manual | `grep -r "Trainerize" apps/web/src/components/marketing/CoachsComparisonTable.tsx` | Competitor names must appear in component |
| MKT-05 | SSG (generateStaticParams + setRequestLocale) + CNIL (next/font) + OG metadata | Build smoke + code | `grep -r "generateStaticParams\|setRequestLocale\|og-coachs.png" apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` | All 3 must be present |
| MKT-06 | Founder section with "Built by athletes, for coaches." mission tagline | Code | `grep -r "TODO.*founder\|athletes.*coaches" apps/web/src/components/marketing/CoachsFounderSection.tsx` | TODO comment + tagline anchor |

---

## Wave 0 Prerequisites (BLOCKING)

These must exist before Wave 2 plans execute:

- [ ] `/apps/web/public/og-coachs.png` — must exist (1200×630 PNG) before `generateMetadata` references it; missing file = broken social sharing
- [ ] `"coachs"` namespace in `apps/web/messages/fr.json` — must exist before `useTranslations('coachs')` is called in any component (TypeScript error + runtime crash otherwise)
- [ ] `"coachs"` namespace in `apps/web/messages/en.json` — same; keys must match fr.json exactly (missing key = `useTranslations` runtime error on EN locale)
- [ ] `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` — page shell must exist before components can be assembled; TypeScript build fails if imports are unresolved

---

## Dimension 8 Verification Commands

```bash
# D8-1: TypeScript clean compile
cd apps/web && npm run type-check

# D8-2: Build smoke (SSG routes both locales)
cd apps/web && npm run build

# D8-3: OG image exists
test -f apps/web/public/og-coachs.png && echo "OG image OK" || echo "MISSING: og-coachs.png"

# D8-4: i18n keys exist in both locales
node -e "const fr = require('./apps/web/messages/fr.json'); const en = require('./apps/web/messages/en.json'); console.log('coachs keys FR:', Object.keys(fr.coachs || {}).length, 'EN:', Object.keys(en.coachs || {}).length)"

# D8-5: CTA href wired
grep -r "coach/onboarding" apps/web/src/components/marketing/CoachsHero.tsx apps/web/src/components/marketing/CoachsCtaFooter.tsx

# D8-6: Competitor names in comparison table
grep -r "Trainerize\|TrueCoach" apps/web/src/components/marketing/CoachsComparisonTable.tsx

# D8-7: Founder TODO placeholder
grep -r "TODO" apps/web/src/components/marketing/CoachsFounderSection.tsx

# D8-8: SSG markers in page shell
grep -r "generateStaticParams\|setRequestLocale" apps/web/src/app/[locale]/\(marketing\)/coachs/page.tsx
```

---

*Phase: 31-public-marketing-coachs*
*Validation strategy created: 2026-05-22*
