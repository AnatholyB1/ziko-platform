---
phase: 35-profile-settings-redesign
plan: G07
type: verification
depends_on: [G01, G02, G03, G04, G05, G06]
autonomous: false
---

# 35-G07 — Gap Fix Verification

## Automated Checks

Run these before human smoke test:

```bash
# TypeScript clean across all changed packages
rtk tsc --noEmit --project apps/mobile/tsconfig.json
rtk tsc --noEmit --project backend/api/tsconfig.json
rtk tsc --noEmit --project packages/ui/tsconfig.json

# G01 — invalidateQueries broadened in edit.tsx
grep -c "invalidateQueries.*measurements" apps/mobile/app/\(app\)/profile/edit.tsx

# G02 — finally block in password handler
grep -c "finally" apps/mobile/app/\(app\)/profile/security.tsx

# G03 — FormData in progress photo upload
grep -c "FormData" apps/mobile/app/\(app\)/profile/index.tsx
# No blob() in progress photo section
grep -n "blob()" apps/mobile/app/\(app\)/profile/index.tsx  # should be 0

# G03 — correct date column
grep -c "date:.*split" apps/mobile/app/\(app\)/profile/index.tsx

# G04 — credits fetched from API
grep -c "credits/balance" apps/mobile/app/\(app\)/profile/settings.tsx

# G05 — theme picker removed from AppearanceSubScreen
grep -c "handleThemeSelect\|activeTheme\|Clair\|Sombre\|Auto" apps/mobile/app/\(app\)/profile/settings.tsx  # should be 0
grep -c "useUnits" apps/mobile/src/hooks/useUnits.ts  # should be ≥1
grep -c "migration.*052\|052_language" supabase/migrations/052_language_region.sql  # file exists

# G06 — referral screen exists
ls apps/mobile/app/\(app\)/profile/referral.tsx
grep -c "GET.*referral\|referral.*GET" backend/api/src/routes/referral.ts
grep -c "referral_code" supabase/migrations/053_referral_schema.sql
```

All checks must pass before proceeding to human smoke test.

## Human Smoke Test

Perform on device/simulator after all automated checks pass:

### G01 — Data refresh
- [ ] Edit bio → save → back to profile → bio updated immediately (no restart)
- [ ] Toggle "Profil public" off → navigate away → return → still off
- [ ] Toggle a notification pref → close settings → reopen → same value

### G02 — Password change
- [ ] Enter password < 8 chars → inline error before submit
- [ ] Enter mismatched confirm → error alert
- [ ] Valid new password → spinner stops, fields clear, success alert

### G03 — Progress photo
- [ ] Upload photo from gallery → no network error → photo appears in gallery
- [ ] Photo persists after app restart (row in body_measurements)

### G04 — Credits
- [ ] Settings > Abonnement > Crédits IA shows real number (not "47 / 100")

### G05 — Apparences
- [ ] Apparence screen has NO theme section (Clair/Sombre/Auto)
- [ ] Change units to Impérial → save → reopen → Impérial selected
- [ ] Measurement screen shows "lb" after switching to Impérial
- [ ] Change language to English → saved (app locale on next cold start)

### G06 — Parrainage
- [ ] Settings > Parrainage row visible, navigates to screen
- [ ] Personal referral code displayed (not mock "THEO-K8X2")
- [ ] Copy button works (clipboard receives code)
- [ ] Partager button opens native share sheet
- [ ] Promo code tab: valid code → green state; invalid → red error
- [ ] Entering a referral code → pending reward message shown

**Resume signal:** Type `gaps-approved` if all checks pass, or describe failures.
