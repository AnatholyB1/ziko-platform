# Phase 21: Mobile UI — Credit Display + Exhaustion UX — Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Mobile-facing UI that makes the credit system visible and actionable: balance indicator in two locations, credit cost labels on AI action buttons, an earn toast after activity saves, and an exhaustion bottom sheet when the 402 fires. No new credit logic — all balance math and earn logic was built in Phases 18–20. This phase is presentation only, plus one small backend extension (earned_today in 402 body).

</domain>

<decisions>
## Implementation Decisions

### Balance Display (CRED-01)
- **D-01:** Credit balance indicator appears in **two places**: (1) AI chat screen header as a compact chip `[3 ⚡]` positioned top-right, and (2) gamification dashboard as a dual-balance card showing coins and AI credits side by side `| 💰 1 240 coins  ⚡ 3 credits |`. No persistent tab bar badge.
- **D-02:** Balance is fetched via `GET /credits/balance` using **`useFocusEffect`** — refetches each time the AI chat screen or gamification dashboard comes into focus. No background polling, no WebSocket. Correct and simple.
- **D-03:** Balance state lives in a new `useCreditStore` Zustand store at `apps/mobile/src/stores/creditStore.ts`. Exposes `{ balance, dailyEarned, dailyCap, resetTimestamp }` and the fetch function. Both screens read from this store — no prop drilling.

### Earn Toast (EARN-08)
- **D-04:** New **floating bottom toast** component: pill/card anchored above the tab bar (bottom: ~80px), auto-dismisses after 2.5s with a fade-out animation (MotiView). Shows `⚡ +1 AI credit earned!`. Non-blocking — user can interact while it's visible.
- **D-05:** Mounted in the root layout (`apps/mobile/app/_layout.tsx`) alongside `<CustomAlert />`. Same mounting pattern — always available globally without routing logic.
- **D-06:** Triggered via `useCreditStore` — add `showEarnToast()` action to the credit store. Activity screens call `useCreditStore.getState().showEarnToast()` after `POST /credits/earn` returns `{ credited: true }`. Store flips a boolean; the toast component reads it and animates in.
- **D-07:** The earn call already fires from the 6 screens (Phase 20). Each screen checks `result.credited` and conditionally calls `showEarnToast()`. No changes to earnCredits.ts logic.

### Exhaustion Bottom Sheet (CRED-05)
- **D-08:** When the AI chat receives a 402 response, show a **rich bottom sheet**: lists all 6 earn activities with today's checkmarks (done/not done), and a countdown to daily quota reset (`Reset dans Xh Ym`). Dismissable with "Fermer" button.
- **D-09:** The 402 response body must be **extended** (backend change in this phase): add `earned_today: string[]` — array of source strings already credited today (e.g., `["workout", "habit"]`). The credit gate middleware already queries `ai_credit_transactions` for today's usage — a small additional query per source is required. Mobile renders checkmarks by checking `earned_today.includes(source)`.
- **D-10:** Bottom sheet is a React Native `Modal` (like `CustomAlert`) — no third-party sheet library. Positioned bottom with `justifyContent: 'flex-end'` on the backdrop. Triggered from `useAIStore` or local state in the AI chat screen when `sendMessage()` receives a 402.
- **D-11:** The sheet reads all needed data from the 402 body: `balance`, `earn_hint`, `earned_today`, `reset_timestamp`. No secondary API call required.

### Cost Labels (CRED-04)
- **D-12:** Credit cost labels appear on exactly **3 buttons**: (1) AI chat send button → `[Send  4⚡]`, (2) AI Programs generate button → `[Generate  4⚡]`, (3) Vision scan button → `[Scan  3⚡]`.
- **D-13:** Costs are **static constants** from a new file `apps/mobile/src/lib/creditCosts.ts`:
  ```ts
  export const CREDIT_COSTS = { chat: 4, scan: 3, program: 4 } as const;
  ```
  Matches `CREDIT_COSTS` in `backend/api/src/config/credits.ts`. No API call, no loading state.

### Claude's Discretion
- Exact MotiView animation spec for toast (duration, easing, offset values)
- Whether to queue multiple earn toasts or deduplicate (last-write-wins is fine for v1)
- Exact icon/color for the ⚡ credit indicator in the header (use theme.primary #FF5C1A or a yellow/gold)
- Whether the AI chat header credit chip navigates to the gamification dashboard on tap

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Credit System — Backend
- `backend/api/src/services/creditService.ts` — `getBalanceSummary()`, `earnCredits()`, daily-cap logic. Read to understand what data is available.
- `backend/api/src/config/credits.ts` — `CREDIT_COSTS`, `DAILY_EARN_CAP`, `DAILY_QUOTAS`. Mobile constants must mirror these values.
- `backend/api/src/routes/credits.ts` — `GET /balance` response shape: `{ balance, daily_earned, daily_cap, reset_timestamp }`.
- `backend/api/src/middleware/creditGate.ts` — Produces the 402 response. Must be extended to add `earned_today` array (D-09).

### Mobile — Existing Stores & Patterns
- `apps/mobile/src/stores/aiStore.ts` — `sendMessage()` is where the 402 must be caught and the bottom sheet triggered.
- `apps/mobile/src/stores/authStore.ts` — Pattern for Zustand store with Supabase session — follow same pattern for `creditStore.ts`.
- `apps/mobile/src/lib/earnCredits.ts` — Shared earn helper from Phase 20. `showEarnToast()` call added after `result.credited`.

### Mobile — UI Screens to Modify
- `apps/mobile/app/(app)/ai/index.tsx` — Add: header credit chip (D-01), cost label on send button (D-12), 402 → bottom sheet trigger (D-10).
- `apps/mobile/app/_layout.tsx` — Mount `<CreditEarnToast />` alongside `<CustomAlert />` (D-05).
- `apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx` → `plugins/gamification/src/screens/GamificationDashboard.tsx` — Add dual-balance card (D-01).
- `plugins/ai-programs/src/screens/AIProgramsDashboard.tsx` — Add cost label on generate button (D-12).
- Nutrition scan screen (vision scan) — Add cost label on scan button (D-12). **Find exact file path.**

### Mobile — Existing Component Patterns
- `apps/mobile/src/components/CustomAlert.tsx` — Reference for the Modal + MotiView mount pattern. Bottom sheet and earn toast follow the same structure.
- `packages/plugin-sdk/src/alert.ts` — `useAlertStore` pattern — `useCreditStore` follows the same Zustand shape.

### Requirements
- `.planning/REQUIREMENTS.md` — CRED-01 (balance visible), CRED-04 (cost labels), CRED-05 (exhaustion sheet), EARN-08 (+1 toast), EARN-09 (daily progress).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MotiView` (from `moti`): already used in `CustomAlert.tsx` and `GamificationDashboard.tsx` — use for earn toast animation (fade/slide in/out).
- `CustomAlert.tsx`: Modal + MotiView spring animation pattern. Earn toast and exhaustion sheet follow the same approach.
- `useAlertStore` from `@ziko/plugin-sdk`: proof that a global Zustand store driving a globally-mounted component works in this codebase.
- `useFocusEffect` from `expo-router`: already used in other plugin screens for on-focus refresh.

### Established Patterns
- **Global modal components mounted in root layout** — `CustomAlert` in `apps/mobile/app/_layout.tsx:70`. Earn toast and bottom sheet follow this pattern.
- **Zustand for global UI state** — all stores in `apps/mobile/src/stores/`. New `creditStore.ts` goes here.
- **Light sport theme, no dark mode** — #FF5C1A primary, #F7F6F3 background, #1C1A17 text. No StyleSheet — inline style objects or NativeWind.
- **`showAlert` from `@ziko/plugin-sdk`** — drop-in for `Alert.alert`. Plugin screens use this, not native Alert.

### Integration Points
- `apps/mobile/app/_layout.tsx` — root layout mounts `<CustomAlert />`. Add `<CreditEarnToast />` and optionally `<CreditExhaustionSheet />` here, or trigger the sheet from the AI chat screen's local state.
- `aiStore.ts sendMessage()` — catches SSE errors. 402 detection happens here → trigger the exhaustion sheet.
- `GamificationDashboard.tsx` hero section — coins are shown in the header area. Dual-balance card placed below the level ring, before the XP bar.

</code_context>

<specifics>
## Specific Ideas

- Balance chip in AI chat header: `[3 ⚡]` — small, right-aligned in the header row. Compact, doesn't crowd the screen title.
- Gamification dual-balance card: coins (💰) and AI credits (⚡) side by side with distinct iconography — explicitly different icons so they're never confused (CRED-07).
- Earn toast wording: `⚡ +1 AI credit earned!` — short, celebratory, no need for the activity name.
- Exhaustion sheet title: `Crédits IA épuisés` with the earn activities listed with source name and a ✓/□ indicator based on `earned_today`.
- Reset countdown: compute from `reset_timestamp` (next UTC midnight from `GET /credits/balance`) → display as `Xh Ym`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-mobile-ui-credit-display-exhaustion-ux*
*Context gathered: 2026-04-09*
