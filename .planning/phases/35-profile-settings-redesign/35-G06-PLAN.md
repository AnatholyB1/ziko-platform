---
phase: 35-profile-settings-redesign
plan: G06
type: gap-fix
depends_on: [G05]
files_modified:
  - supabase/migrations/053_referral_schema.sql
  - backend/api/src/routes/referral.ts
  - backend/api/src/index.ts
  - apps/mobile/app/(app)/profile/referral.tsx
  - apps/mobile/app/(app)/profile/settings.tsx
autonomous: true
gap_refs: [smoke-G07-parrainage]
---

# 35-G06 — Parrainage: Full Implementation (track-only rewards)

## Mockup

Two-tab screen (extras.jsx `ReferralScreen`):
- **Tab 1 "Parraine un ami":** dark hero card + personal code + copy/share buttons +
  progress bar (X/5 → badge Ambassadeur) + invitation list with status
- **Tab 2 "Code promo":** text input + validate button + success/error state

## Reward model

No automatic reward disbursement. When an invite is accepted:
- Set `app_invites.status = 'reward_pending'` for both inviter row + invitee record
- Show UI message: *"Récompense en attente — notre équipe valide et crédite sous 48h"*
- Admin can update `status = 'rewarded'` manually via Supabase dashboard

## Tasks

### Task 1 — Migration 053

Create `supabase/migrations/053_referral_schema.sql`:

```sql
-- 053 — Referral & promo schema

-- 1. Personal referral code per user
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate code on insert if not set (NAME prefix + 4 random chars)
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  handle TEXT;
  code TEXT;
BEGIN
  SELECT UPPER(COALESCE(SUBSTRING(COALESCE(u.handle, u.name, 'USER'), 1, 4), 'USER'))
  INTO handle FROM public.user_profiles u WHERE id = user_id;
  LOOP
    code := handle || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Back-fill existing users
UPDATE public.user_profiles
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL;

-- 2. Extend app_invites
ALTER TABLE public.app_invites
  ADD COLUMN IF NOT EXISTS invitee_email TEXT,
  ADD COLUMN IF NOT EXISTS invitee_name  TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'reward_pending', 'rewarded'));

-- 3. Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_pct INTEGER CHECK (discount_pct BETWEEN 1 AND 100),
  max_uses    INTEGER,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: anyone authenticated can read active promo codes (for validation)
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_read" ON public.promo_codes
  FOR SELECT TO authenticated USING (is_active = true);

-- 4. Track promo code usage per user
CREATE TABLE IF NOT EXISTS public.user_promo_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_id    UUID NOT NULL REFERENCES public.promo_codes(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, promo_id)
);
ALTER TABLE public.user_promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_redemptions_own" ON public.user_promo_redemptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Apply: `npx supabase db push`.

### Task 2 — Backend Hono routes

Create `backend/api/src/routes/referral.ts`:

```ts
// GET /referral — get my referral code + stats
// POST /referral/redeem — redeem someone's code (marks invite as accepted, sets reward_pending)
// POST /promo/validate — check if a promo code is valid
// POST /promo/apply — apply promo to current user
```

**GET /referral:**
- Fetch `user_profiles.referral_code` for the current user (generate if null)
- Count `app_invites` rows where `inviter_id = userId` grouped by status
- Return: `{ code, invites: { pending, accepted, reward_pending, rewarded }, total_accepted }`

**POST /referral/redeem `{ code }`:**
- Validate code exists in `user_profiles.referral_code`, not own code
- Check user hasn't already used a referral code (`user_profiles` has `used_referral_code` flag — add column)
- Insert `app_invites { inviter_id: codeOwner, invite_code: code, used_by: currentUser, status: 'reward_pending' }`
- Return: `{ ok: true, message: "Récompense en attente — notre équipe valide et crédite sous 48h" }`

**POST /promo/validate `{ code }`:**
- Look up `promo_codes` where `code = ? AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`
- Check `max_uses` not exceeded
- Return: `{ valid: boolean, description?, discount_pct? }`

**POST /promo/apply `{ code }`:**
- Re-validate (same as above)
- Insert `user_promo_redemptions` (UNIQUE constraint prevents double-redemption)
- Increment `promo_codes.uses_count`
- Return: `{ ok: true, discount_pct }`

Register in `backend/api/src/index.ts`:
```ts
import { referralRoutes } from './routes/referral';
app.route('/referral', referralRoutes);
app.route('/promo', promoRoutes);  // can be same file, split by prefix
```

All routes protected by existing `authMiddleware`.

### Task 3 — Mobile ReferralScreen

Create `apps/mobile/app/(app)/profile/referral.tsx` matching the mockup:

**Structure:**
- Header with back chevron + title "Parrainage"
- SubTabs: ["Parraine un ami", "Code promo"]

**Tab 1 — Parraine un ami:**
- Dark hero card (gradient `#1C1A17 → #2A2521`): "1 mois offert par ami inscrit" +
  subtitle "Ton ami reçoit aussi 1 mois gratuit. Notre équipe valide les récompenses sous 48h."
- Code card (dashed orange border): `referral.code` in 22px display font + "Copier" button
- Share row: SMS button (`Share.share` with SMS deep-link) + Partager button (native share sheet)
- Progress card: `{total_accepted}/5` bar → "Atteins 5 amis → badge Ambassadeur"
- Invitation list: rows from `referral.invites` with name (first initial avatar) + status label:
  - `accepted` / `reward_pending` / `rewarded` → "Inscrit · Récompense en attente" / "Inscrit · Récompensé"
  - `pending` → "Code envoyé · pas encore inscrit"

**Tab 2 — Code promo:**
- Helper text explaining the field
- Uppercase text input, "Appliquer" button
- `POST /promo/validate` on input change (debounced 500ms) → green success chip or red error
- "Appliquer" → `POST /promo/apply` → success alert or error

Data fetch: `useQuery(['referral', userId])` → `GET /referral`.
Copy: `Clipboard.setStringAsync(code)` from `expo-clipboard`.

### Task 4 — Add Parrainage row to Settings

In `settings.tsx`, add to the "Préférences" STGroup:

```tsx
<STRow
  icon="gift-outline"
  tint="#E8A33A"
  label="Parrainage"
  sub="Code promo · Inviter un ami"
  onPress={() => router.push('/(app)/profile/referral')}
/>
```

## Success Criteria

- [ ] Migration 053 applied, all existing users have a `referral_code`
- [ ] `GET /referral` returns code + stats
- [ ] Copy button copies code to clipboard
- [ ] Share button opens native share sheet
- [ ] Redeeming a code → `reward_pending` status → pending message shown
- [ ] Promo code validation shows green/red state
- [ ] Settings Parrainage row navigates to screen
- [ ] TypeScript: zero errors
