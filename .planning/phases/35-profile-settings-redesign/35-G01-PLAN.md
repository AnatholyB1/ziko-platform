---
phase: 35-profile-settings-redesign
plan: G01
type: gap-fix
depends_on: []
files_modified:
  - apps/mobile/app/(app)/profile/edit.tsx
  - apps/mobile/app/(app)/profile/security.tsx
  - apps/mobile/app/(app)/profile/settings.tsx
autonomous: true
gap_refs: [smoke-G01, smoke-G02-toggles, smoke-G05-toggles]
---

# 35-G01 — Cache Invalidation + Mutation Wiring

## Problem

Three distinct "save but no visual update" bugs traced to the same root causes:

1. **Profile edit** — `edit.tsx` calls `invalidateQueries(['profile', userId])` but the
   ProfileScreen tab (index.tsx) also caches stats separately under `['measurements', userId]`
   and `['badges', userId]`. After edit, the profile header still shows stale name/bio/handle
   because those tab queries are not invalidated.

2. **Security toggles** — `security.tsx` `updatePrivacy` correctly writes `is_public` to the
   DB column, but `show_stats` / `show_activities` write to `settings JSONB` via a path that
   upserts `{ id: userId, settings: { ...current, privacy: { ... } } }` — the spread of
   `current` requires a prior SELECT to populate current settings. If the initial fetch hasn't
   resolved yet, `current` is `{}` and previous JSONB keys are wiped. Fix: always re-fetch
   current settings before upsert.

3. **Notification toggles** — `settings.tsx` `updateToggle` uses a `setTimeout` debounce
   that reads `current` from a `useRef` snapshot. If two toggles fire in rapid succession,
   the second write uses stale `current` (race condition). Fix: read fresh settings from
   Supabase before each write, not from a stale ref.

## Tasks

### Task 1 — Profile edit: broaden invalidation scope

In `edit.tsx`, after a successful save, invalidate all profile-related query keys:

```ts
queryClient.invalidateQueries({ queryKey: ['profile', userId] });
queryClient.invalidateQueries({ queryKey: ['measurements', userId] });
queryClient.invalidateQueries({ queryKey: ['badges', userId] });
```

Both save handlers (bio/handle and avatar) must invalidate all three keys.

### Task 2 — Security toggles: safe JSONB upsert

In `security.tsx` `updatePrivacy`, for keys that write to JSONB (show_stats,
show_activities), replace the stale-ref pattern with a fresh fetch before upsert:

```ts
const { data: fresh } = await supabase
  .from('user_profiles')
  .select('settings')
  .eq('id', userId)
  .single();
const current = (fresh as any)?.settings ?? {};
await supabase.from('user_profiles').update({
  settings: { ...current, privacy: { ...current.privacy, [key]: value } },
}).eq('id', userId);
```

`is_public` already writes to its dedicated column — leave that path unchanged.
After write, call `queryClient.invalidateQueries({ queryKey: ['profile', userId] })`.

### Task 3 — Notification toggles: safe JSONB upsert

In `settings.tsx` `updateToggle`, replace the `saveRef`/stale-`current` pattern with a
fresh fetch before each debounced write (same pattern as Task 2):

```ts
saveRef.current = setTimeout(async () => {
  const { data: fresh } = await supabase
    .from('user_profiles').select('settings').eq('id', userId).single();
  const current = (fresh as any)?.settings ?? {};
  await supabase.from('user_profiles').update({
    settings: { ...current, notif_prefs: next },
  }).eq('id', userId);
}, 600);
```

## Success Criteria

- [ ] Change bio in edit screen → back → bio updated immediately without restart
- [ ] Toggle "Profil public" off → close screen → reopen → still off
- [ ] Toggle notification pref → close → reopen settings → same value
- [ ] TypeScript: zero errors
