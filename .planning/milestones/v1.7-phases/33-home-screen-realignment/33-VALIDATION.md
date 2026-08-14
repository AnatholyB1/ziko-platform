---
phase: 33
slug: home-screen-realignment
created: 2026-05-21
---

# Phase 33 — Validation Strategy

## Validation Architecture

### Automated Checks (from plan 33-05 Task 1)

| # | Check | Command | PASS Condition |
|---|-------|---------|----------------|
| 1 | TypeScript compile — zero errors | `cd C:/ziko-platform && npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 \| grep -E "error TS\|error:" \| grep -v "node_modules" \| head -30` | Zero lines output |
| 2 | Fixture purge — no PROFILE/STREAK/TODAY/FORME/RECENT/ALL_PLUGINS/AI_TIPS | `grep -v '^[[:space:]]*//' apps/mobile/app/(app)/index.tsx \| grep -cE "const (PROFILE\|STREAK\|TODAY\|FORME\|RECENT\|ALL_PLUGINS\|AI_TIPS)\s*="` | Output is 0 |
| 3 | Cross-plugin require() purge | `grep -cE "require\('@ziko/plugin-(sleep\|hydration\|journal\|measurements)'\)" apps/mobile/app/(app)/index.tsx` | Output is 0 |
| 4a | @ziko/ui FormRing imported | `grep -c "from '@ziko/ui'" apps/mobile/app/(app)/index.tsx` | >= 1 |
| 4b | Local FormRing function deleted | `grep -c "^function FormRing" apps/mobile/app/(app)/index.tsx` | 0 |
| 5a | PluginsDrawer uses visible prop | `grep -c "visible={drawerOpen}" apps/mobile/app/(app)/index.tsx` | >= 1 |
| 5b | PluginsDrawer does not use open prop | `grep -c "open={drawerOpen}" apps/mobile/app/(app)/index.tsx` | 0 |
| 6 | useHomeData exports 8 hooks | `grep -c "^export function use" apps/mobile/src/hooks/useHomeData.ts` | 8 |
| 7a | useAITips uses appStorage for dismiss | `grep -c "appStorage" apps/mobile/src/hooks/useAITips.ts` | >= 2 |
| 7b | useAITips does not use MMKV | `grep -v '^[[:space:]]*//' apps/mobile/src/hooks/useAITips.ts \| grep -c "mmkv\|MMKV"` | 0 |
| 8 | useSmartActions slices to max 2 cards | `grep -c "slice(0, 2)" apps/mobile/src/hooks/useSmartActions.ts` | 1 |
| 9 | FireAndForget wired to /ai/tools/execute | `grep -c "ai/tools/execute" apps/mobile/app/(app)/index.tsx` | >= 1 |
| 10 | paddingBottom: 100 for tab bar clearance | `grep -c "paddingBottom.*100\|paddingBottom: 100" apps/mobile/app/(app)/index.tsx` | >= 1 |
| 11 | maybeSingle() used for optional queries | `grep -c "maybeSingle" apps/mobile/src/hooks/useHomeData.ts` | >= 2 |
| 12 | is_active boolean filter | `grep -c "is_active.*true" apps/mobile/src/hooks/useHomeData.ts` | 1 |

### Human Smoke Test (plan 33-05 Task 2)

Start `npx expo start` and verify each of the following manually on a device or simulator:

1. **FormeDuJour ring**: 4 colored segments visible (violet=sleep, blue=water, orange=nutrition, green=load). Center score 0–100. Non-zero segments when user has today's data.
2. **MissionCard**: Dark card shows session name + up to 3 exercises when `ai_generated_programs.is_active=true`. Empty state with "Aucun programme actif" CTA when no active program.
3. **AICoachInline**: Tip text changes every 6.5s. "Plus tard" dismisses for 24h. "J'applique" on the hydration tip logs +250ml water AND dismisses for 24h.
4. **QuickLog water**: "+250ml" tap → blue border + confirmed badge appears. Tap twice → total updates to XL format.
5. **QuickLog mood**: "Humeur" tap → 5-emoji picker opens. Tap emoji → logs mood and closes sheet.
6. **QuickLog weight**: "Poids" tap → numeric input opens. Enter value + "Confirmer" → logs weight and closes.
7. **QuickLog meal**: "Repas" tap → navigates to nutrition log (no modal).
8. **WeekStrip**: Current week shows real dots: green checkmark = done session, dark cell = today, transparent = rest.
9. **Recent sessions**: Up to 3 latest `workout_sessions` visible with name, date, duration, volume. Empty state if none.
10. **PluginsDrawer**: "Tous mes outils" CTA → drawer opens showing only the user's enabled plugins from `user_plugins` (not all 17 static manifests). Tapping a plugin navigates to it and closes the drawer.
11. **Header**: Shows authenticated user's first name (not "Léo" fixture). Streak count chip visible if streak > 0.
12. **No fixtures visible**: No hardcoded names, fixture labels, or "AI_TIPS" text visible anywhere on the home screen.
