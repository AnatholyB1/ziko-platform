---
phase: 35-profile-settings-redesign
plan: G04
type: gap-fix
depends_on: []
files_modified:
  - apps/mobile/app/(app)/profile/settings.tsx
autonomous: true
gap_refs: [smoke-G04-credits]
---

# 35-G04 — Crédits IA: Real Balance from Backend

## Problem

The "Crédits IA" row in Settings shows a hardcoded value (e.g. "47 / 100").
Backend route `GET /credits/balance` already exists (v1.4, Phase 19) and returns:
`{ ai_credits: number, daily_earned: number, daily_cap: number }`.

## Tasks

### Task 1 — Add TanStack Query fetch for credit balance

In `settings.tsx` main `SettingsScreen`, add a query alongside the existing profile fetch:

```ts
const { data: credits } = useQuery({
  queryKey: ['credits-balance', userId],
  queryFn: async () => {
    const res = await fetch(`${API_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    return res.json() as Promise<{ ai_credits: number; daily_cap: number }>;
  },
  staleTime: 60_000,
});
```

`API_URL` and `session` are already available in the settings screen context.

### Task 2 — Display real value in the Credits row

Replace the hardcoded string in the STRow:

```ts
// BEFORE:
<STRow icon="bolt-outline" tint="#E8A33A" label="Crédits IA"
  right="47 / 100" onPress={() => {}} />

// AFTER:
<STRow icon="bolt-outline" tint="#E8A33A" label="Crédits IA"
  right={credits ? `${credits.ai_credits} / ${credits.daily_cap}` : '—'}
  onPress={() => {}} />
```

## Success Criteria

- [ ] Crédits IA row shows real balance fetched from `/credits/balance`
- [ ] Shows `—` while loading (no crash)
- [ ] TypeScript: zero errors
