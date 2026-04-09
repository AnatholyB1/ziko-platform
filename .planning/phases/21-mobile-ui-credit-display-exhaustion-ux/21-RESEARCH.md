# Phase 21: Mobile UI — Credit Display + Exhaustion UX — Research

**Researched:** 2026-04-09
**Domain:** React Native UI components, Zustand store patterns, MotiView animations, Hono middleware extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Balance Display (CRED-01)**
- D-01: Credit balance indicator in two places: (1) AI chat header chip `[3 ⚡]` top-right, (2) gamification dashboard dual-balance card `| 💰 1 240 coins  ⚡ 3 credits |`. No persistent tab bar badge.
- D-02: Balance fetched via `GET /credits/balance` using `useFocusEffect` — refetches on every focus. No polling, no WebSocket.
- D-03: Balance state in new `useCreditStore` Zustand store at `apps/mobile/src/stores/creditStore.ts`. Exposes `{ balance, dailyEarned, dailyCap, resetTimestamp }` plus fetch function.

**Earn Toast (EARN-08)**
- D-04: New floating bottom toast pill anchored above tab bar (bottom: ~80px), auto-dismisses after 2.5s with MotiView fade-out. Shows `⚡ +1 AI credit earned!`. Non-blocking.
- D-05: Mounted in root layout `apps/mobile/app/_layout.tsx` alongside `<CustomAlert />`.
- D-06: Triggered via `useCreditStore.showEarnToast()` action. Activity screens call this after `POST /credits/earn` returns `{ credited: true }`.
- D-07: Earn call already fires from 6 screens (Phase 20). Each screen checks `result.credited` and conditionally calls `showEarnToast()`. No changes to earnCredits.ts logic.

**Exhaustion Bottom Sheet (CRED-05)**
- D-08: 402 response triggers rich bottom sheet listing all 6 earn activities with today's checkmarks (done/not done) and countdown to daily quota reset. Dismissable with "Fermer" button.
- D-09: 402 response body MUST be extended (backend change): add `earned_today: string[]` — array of source strings already credited today. creditGate.ts must query `ai_credit_transactions` for today per source.
- D-10: Bottom sheet is a React Native `Modal` (no third-party library). Backdrop with `justifyContent: 'flex-end'`. Triggered from `useAIStore` or local state in AI chat when `sendMessage()` receives 402.
- D-11: Sheet reads all data from 402 body: `balance`, `earn_hint`, `earned_today`, `reset_timestamp`. No secondary API call.

**Cost Labels (CRED-04)**
- D-12: Cost labels on exactly 3 buttons: (1) AI chat send → `[Send  4⚡]`, (2) AI Programs generate → `[Generate  4⚡]`, (3) Vision scan → `[Scan  3⚡]`.
- D-13: Costs from static file `apps/mobile/src/lib/creditCosts.ts`: `export const CREDIT_COSTS = { chat: 4, scan: 3, program: 4 } as const;`

### Claude's Discretion
- Exact MotiView animation spec for toast (duration, easing, offset values)
- Whether to queue multiple earn toasts or deduplicate (last-write-wins is fine for v1)
- Exact icon/color for the ⚡ credit indicator in the header (theme.primary #FF5C1A or yellow/gold)
- Whether the AI chat header credit chip navigates to the gamification dashboard on tap

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-01 | User can see their AI credit balance in the app at all times | useCreditStore + useFocusEffect on AI chat + gamification screens |
| CRED-04 | User sees the credit cost displayed next to each AI action button before using it | Static creditCosts.ts constants displayed on 3 buttons |
| CRED-05 | User sees an exhaustion bottom sheet when credits reach 0, explaining why and how to earn more | 402 detection in aiStore.sendMessage → Modal bottom sheet with earned_today data |
| EARN-08 | User sees a "+1 AI credit" toast after earning credits from an activity | CreditEarnToast MotiView component in root layout, triggered from creditStore.showEarnToast() |
| EARN-09 | User sees daily earn progress ("2 credits available — log a stretch to earn") | Exhaustion sheet lists all 6 sources with checkmarks from earned_today; balance chip shows current count |
</phase_requirements>

---

## Summary

Phase 21 is a pure presentation layer. All credit logic (balance math, earn cap, atomic deduction) was built in Phases 17–20. This phase makes that invisible backend system visible in the UI through four delivery surfaces: a balance chip, a dual-balance card, an earn toast, and an exhaustion bottom sheet.

The work spans one backend extension (adding `earned_today` to the 402 response body) and five UI areas: a new Zustand store, a new global toast component, a new global bottom sheet component, one new static constants file, and modifications to three existing screens plus the root layout.

All patterns required (Modal + MotiView animations, Zustand global stores, useFocusEffect for data refresh) are already present in the codebase. The research phase found exact file paths and implementation details for every surface to be modified.

**Primary recommendation:** Build in wave order — (1) creditStore.ts + creditCosts.ts, (2) backend earned_today extension, (3) CreditEarnToast + mount in layout, (4) CreditExhaustionSheet + 402 detection in aiStore, (5) balance chip in AI chat, (6) dual-balance card in gamification, (7) cost labels on 3 buttons.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `moti` | (already installed) | MotiView spring/fade animations | Already used in CustomAlert and GamificationDashboard — project standard |
| `zustand` | v5 (already installed) | Global credit UI state (creditStore) | Project-wide state solution |
| `expo-router` | v4 (already installed) | `useFocusEffect` for on-focus balance refresh | Already used in supplements plugin for same pattern |
| `react-native` | (project RN 0.81) | Modal for bottom sheet | Locked by D-10 — no third-party sheet library |
| `@expo/vector-icons` Ionicons | (already installed) | ⚡ icon or flash-outline | Project icon standard |

**Installation:** No new packages required. All libraries are already installed. [VERIFIED: codebase grep]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-safe-area-context` | (installed) | SafeAreaView in bottom sheet | All plugin screens use this |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Native Modal (D-10 locked) | `@gorhom/bottom-sheet` | Smoother gesture dismiss, but adds dependency and contradicts D-10 |
| MotiView fade (D-04 locked) | Animated API | MotiView is simpler and already used; Animated API requires more boilerplate |

---

## Architecture Patterns

### File Structure for Phase 21
```
apps/mobile/
  src/
    stores/
      creditStore.ts          ← NEW: { balance, dailyEarned, dailyCap, resetTimestamp, showEarnToast() }
    lib/
      creditCosts.ts          ← NEW: CREDIT_COSTS = { chat: 4, scan: 3, program: 4 }
    components/
      CreditEarnToast.tsx     ← NEW: floating bottom toast, MotiView fade
      CreditExhaustionSheet.tsx ← NEW: Modal bottom sheet for 402 state
  app/
    _layout.tsx               ← MODIFY: mount <CreditEarnToast /> and <CreditExhaustionSheet />
    (app)/
      ai/
        index.tsx             ← MODIFY: header chip, send cost label, 402 trigger
plugins/
  gamification/src/screens/
    GamificationDashboard.tsx ← MODIFY: dual-balance card after level ring
  ai-programs/src/screens/
    GenerateProgram.tsx       ← MODIFY: generate button cost label
  nutrition/src/screens/
    LogMealScreen.tsx         ← MODIFY: scan button cost label (scan tab)
backend/api/src/middleware/
  creditGate.ts               ← MODIFY: add earned_today to 402 body (D-09)
```

### Pattern 1: Global Store + Global Component (CustomAlert model)
**What:** A Zustand store holds UI state (visible boolean + payload). A component mounted in the root layout reads the store and renders. Any screen calls `useStore.getState().action()` to trigger.

**When to use:** Any UI that can be triggered from any screen without routing context.

**Example (existing — useAlertStore):**
```typescript
// Source: packages/plugin-sdk/src/alert.ts [VERIFIED: read directly]
export const useAlertStore = create<AlertState>()((set) => ({
  visible: false,
  title: '',
  show: (title, message, buttons) => set({ visible: true, title, message, buttons }),
  hide: () => set({ visible: false }),
}));
```
`creditStore.ts` follows this exact shape with `showEarnToast()` / `hideEarnToast()` actions.

**CreditEarnToast pattern:**
```typescript
// apps/mobile/src/components/CreditEarnToast.tsx
// Source: CustomAlert.tsx pattern [VERIFIED: read directly]
import { MotiView } from 'moti';

export default function CreditEarnToast() {
  const { toastVisible, hideToast } = useCreditStore();
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => hideToast(), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  if (!toastVisible) return null;

  return (
    <View style={{ position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', zIndex: 999, pointerEvents: 'none' }}>
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: 20 }}
        transition={{ type: 'timing', duration: 300 }}
        style={{
          backgroundColor: theme.surface,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Ionicons name="flash" size={18} color="#FFB800" />
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
          +1 AI credit earned!
        </Text>
      </MotiView>
    </View>
  );
}
```

### Pattern 2: useFocusEffect for On-Focus Data Refresh
**What:** Wraps a data-fetch callback in `useCallback` and passes it to `useFocusEffect`. Fires every time the screen comes into view.

**When to use:** Balance display — must be fresh when user returns from an activity screen that may have earned a credit.

**Example (existing — SupplementsListScreen):**
```typescript
// Source: plugins/supplements/src/screens/SupplementsListScreen.tsx [VERIFIED: read directly]
useFocusEffect(useCallback(() => { setHasMore(true); loadSupplements(); }, [...]));
```

**For creditStore:**
```typescript
// In AI chat screen and gamification dashboard
const fetchBalance = useCreditStore((s) => s.fetchBalance);
useFocusEffect(useCallback(() => { fetchBalance(); }, []));
```

### Pattern 3: 402 Detection in sendMessage
**What:** The XHR in `AIBridge.sendMessage()` rejects with `new Error('AI API error 402: ...')` when the server returns HTTP 402. The AI chat screen wraps `sendMessage()` in a try/catch and inspects the error message.

**Critical finding:** `AIBridge.sendMessage()` uses XHR. When the server returns 402 (before the stream starts), `xhr.onload` fires with `xhr.status === 402`. The rejection message is:
```
AI API error 402: {"error":"insufficient_credits","balance":0,"required":4,...}
```

The catch block in the AI chat screen must parse the error to extract the 402 body.

**Current sendMessage in aiStore.ts (lines 130-154):**
```typescript
// Source: apps/mobile/src/stores/aiStore.ts [VERIFIED: read directly]
try {
  await aiBridge.sendMessage(...);
} catch (err) {
  set({ isStreaming: false, streamingContent: '' });
  throw err;  // ← re-throws. AI chat screen's handleSend() catches this.
}
```

The AI chat screen's `handleSend()` currently swallows the error silently:
```typescript
// Source: apps/mobile/app/(app)/ai/index.tsx lines 201-209 [VERIFIED: read directly]
const handleSend = async () => {
  const text = input.trim();
  if (!text || isStreaming) return;
  setInput('');
  try {
    await sendMessage(text);
  } catch {
    // Error handled in store  ← currently no 402 detection here
  }
};
```

**Required change:** Parse the caught error to detect 402:
```typescript
} catch (err: any) {
  const msg = err?.message ?? '';
  const match = msg.match(/^AI API error 402: (.+)$/);
  if (match) {
    try {
      const body = JSON.parse(match[1]);
      // Show exhaustion sheet with body data
      useCreditStore.getState().showExhaustionSheet(body);
    } catch {}
  }
}
```

### Pattern 4: Backend earned_today Extension (D-09)
**What:** Add `earned_today: string[]` to the 402 body in `creditGate.ts`. Query `ai_credit_transactions` for all earn records for this user today, group by source.

**Current 402 body (creditGate.ts lines 77-87):**
```typescript
// Source: backend/api/src/middleware/creditGate.ts [VERIFIED: read directly]
return c.json({
  error: 'insufficient_credits',
  balance: quota.balance,
  required: cost,
  daily_used: quota.dailyUsed,
  daily_quota: quota.dailyQuota,
  earn_hint: quota.earnHint,
}, 402);
```

**Extension needed:**
```typescript
// Query today's earned sources
const todayUTC = new Date().toISOString().split('T')[0];
const { data: earnedRows } = await supabase
  .from('ai_credit_transactions')
  .select('source')
  .eq('user_id', userId)
  .eq('type', 'earn')
  .gte('created_at', `${todayUTC}T00:00:00Z`);

const earned_today = (earnedRows ?? []).map((r: any) => r.source);
const reset_timestamp = new Date(Date.UTC(
  new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1
)).toISOString();

return c.json({
  error: 'insufficient_credits',
  balance: quota.balance,
  required: cost,
  daily_used: quota.dailyUsed,
  daily_quota: quota.dailyQuota,
  earn_hint: quota.earnHint,
  earned_today,
  reset_timestamp,
}, 402);
```

`supabase` client is already instantiated in `creditGate.ts` at the top of the file. No new imports needed.

### Anti-Patterns to Avoid
- **Polling for balance:** Do not use `setInterval` or `useEffect` with a timer. `useFocusEffect` is the correct pattern (D-02).
- **Using Alert.alert in plugin screens:** GamificationDashboard and GenerateProgram currently use `Alert.alert` — but cost labels are read-only UI, no alert needed for labels. However, note that GamificationDashboard line 46 uses `Alert.alert` for gift sending; this is an existing violation that is out of scope for this phase.
- **Adding third-party bottom sheet:** D-10 explicitly forbids this. Use React Native Modal.
- **Making a secondary API call from the exhaustion sheet:** D-11 forbids this. All data comes from the 402 body.
- **Mounting toast inside plugin screens:** Toast must be in root layout (D-05), not in individual screens.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast animation | Custom Animated API sequence | MotiView `from`/`animate`/`transition` | Already used in CustomAlert; simpler API, spring physics built-in |
| Bottom sheet | `PanResponder` gesture handler | React Native `Modal` with `justifyContent: 'flex-end'` | Sufficient for non-gesture-dismissable sheet per D-10 |
| Countdown timer | Date arithmetic loop | `Math.floor((resetMs - Date.now()) / 1000)` with `setInterval` for display only | Simple arithmetic; no library needed |
| Balance API call | Inline fetch | `GET /credits/balance` via creditStore.fetchBalance() | Already defined with correct shape |

**Key insight:** This phase is presentation-only. Every data source already exists in the backend. The complexity is in wiring, not in new logic.

---

## Common Pitfalls

### Pitfall 1: XHR 402 Response Not Parsed
**What goes wrong:** The error thrown by AIBridge has message `"AI API error 402: <JSON string>"`. If the catch block doesn't parse the JSON suffix, the exhaustion sheet receives no data.
**Why it happens:** `xhr.onload` rejects with a string message, not a structured error object.
**How to avoid:** Use regex `match(/^AI API error 402: (.+)$/)` then `JSON.parse(match[1])` in a try/catch.
**Warning signs:** Exhaustion sheet shows empty/undefined fields.

### Pitfall 2: Toast Flickers on Multiple Earn Events
**What goes wrong:** If `showEarnToast()` is called while a toast is already visible, the 2.5s timer resets but the MotiView re-mounts visibly.
**Why it happens:** The `toastVisible` boolean flips false then true, causing a re-render.
**How to avoid:** Debounce: if `toastVisible` is already true, reset the timer without re-animating. Use a ref for the timer and clear it before setting a new one. Last-write-wins is acceptable per discretion.

### Pitfall 3: useFocusEffect Missing useCallback
**What goes wrong:** `useFocusEffect` receives a new function reference on every render, causing infinite refetch loops.
**Why it happens:** `useFocusEffect` compares callback by reference.
**How to avoid:** Always wrap the callback with `useCallback`: `useFocusEffect(useCallback(() => { fetchBalance(); }, []))`.
**Warning signs:** Network tab shows continuous balance requests.

### Pitfall 4: earned_today Includes Duplicate Sources
**What goes wrong:** A user who earned 2 credits from 'workout' (once each day reset) would show 'workout' twice in `earned_today`, causing the sheet to render the checkbox as checked then unchecked unexpectedly.
**Why it happens:** The query fetches all rows, not distinct sources.
**How to avoid:** Deduplicate: `[...new Set(earnedRows.map(r => r.source))]` before returning.

### Pitfall 5: Modal Keyboard Overlap
**What goes wrong:** The exhaustion bottom sheet appears behind the keyboard if the AI chat text input is focused.
**Why it happens:** Modal `visible` renders above the keyboard by default on iOS but not always on Android.
**How to avoid:** Dismiss keyboard before showing sheet: `Keyboard.dismiss()` in the catch block before calling `showExhaustionSheet()`. Or use `statusBarTranslucent` on the Modal (same as CustomAlert uses).

### Pitfall 6: GamificationDashboard Uses Alert.alert
**What goes wrong:** GamificationDashboard (`handleSendGift`) uses `Alert.alert` directly — a known violation per CLAUDE.md. This is a pre-existing bug.
**Scope:** Out of scope for Phase 21 — but do NOT introduce any additional `Alert.alert` calls in new code.
**How to avoid:** Use `showAlert` from `@ziko/plugin-sdk` for any new alert-style interactions added in this phase.

---

## Code Examples

Verified patterns from codebase:

### creditStore.ts Shape (following useAlertStore pattern)
```typescript
// Source: packages/plugin-sdk/src/alert.ts + apps/mobile/src/stores/authStore.ts [VERIFIED]
// apps/mobile/src/stores/creditStore.ts
import { create } from 'zustand';

interface CreditExhaustionData {
  balance: number;
  required: number;
  earned_today: string[];
  earn_hint: string;
  reset_timestamp: string;
}

interface CreditState {
  balance: number;
  dailyEarned: number;
  dailyCap: number;
  resetTimestamp: string | null;
  toastVisible: boolean;
  exhaustionVisible: boolean;
  exhaustionData: CreditExhaustionData | null;

  fetchBalance: () => Promise<void>;
  showEarnToast: () => void;
  hideEarnToast: () => void;
  showExhaustionSheet: (data: CreditExhaustionData) => void;
  hideExhaustionSheet: () => void;
}
```

### Balance Chip in AI Chat Header
```typescript
// Source: apps/mobile/app/(app)/ai/index.tsx lines 238-261 [VERIFIED: existing header structure]
// Insert after the flex:1 title View, alongside/replacing the community button
const balance = useCreditStore((s) => s.balance);
// In the header row View (flexDirection: 'row', alignItems: 'center', gap: 10):
<TouchableOpacity style={{
  flexDirection: 'row', alignItems: 'center', gap: 4,
  backgroundColor: '#FFB80015', borderRadius: 12,
  paddingHorizontal: 10, paddingVertical: 6,
}}>
  <Ionicons name="flash" size={14} color="#FFB800" />
  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{balance}</Text>
</TouchableOpacity>
```

### Cost Label on Send Button
```typescript
// Source: apps/mobile/app/(app)/ai/index.tsx lines 318-334 [VERIFIED: existing send button]
// Current: width:44, height:44 circle with Ionicons send icon
// Replacement: wider pill showing "4⚡"
import { CREDIT_COSTS } from '../../../src/lib/creditCosts';
<TouchableOpacity
  onPress={handleSend}
  disabled={!input.trim() || isStreaming}
  style={{
    height: 44,
    borderRadius: 22,
    backgroundColor: input.trim() && !isStreaming ? theme.primary : theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 4,
  }}
>
  {isStreaming
    ? <ActivityIndicator size="small" color="#fff" />
    : <>
        <Ionicons name="send" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{CREDIT_COSTS.chat}⚡</Text>
      </>
  }
</TouchableOpacity>
```

### Root Layout Mount Point
```typescript
// Source: apps/mobile/app/_layout.tsx lines 70-72 [VERIFIED: read directly]
// Current mounting pattern:
<CustomAlert />
<BugReportModal />

// After Phase 21:
<CustomAlert />
<BugReportModal />
<CreditEarnToast />
<CreditExhaustionSheet />
```

### Exhaustion Sheet — Earn Activities List
```typescript
// All 6 sources with labels for the bottom sheet
const EARN_ACTIVITIES = [
  { source: 'workout',     label: 'Log a workout',          icon: 'barbell-outline' },
  { source: 'habit',       label: 'Complete daily habits',  icon: 'checkmark-circle-outline' },
  { source: 'meal',        label: 'Log a meal',             icon: 'restaurant-outline' },
  { source: 'measurement', label: 'Log body measurements',  icon: 'body-outline' },
  { source: 'stretch',     label: 'Complete a stretch',     icon: 'fitness-outline' },
  { source: 'cardio',      label: 'Log a cardio session',   icon: 'bicycle-outline' },
] as const;

// Render each with check/uncheck based on earned_today
{EARN_ACTIVITIES.map(({ source, label, icon }) => {
  const done = exhaustionData?.earned_today?.includes(source) ?? false;
  return (
    <View key={source} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={done ? '#4CAF50' : theme.muted}
      />
      <Text style={{ color: done ? theme.muted : theme.text, fontSize: 15,
        textDecorationLine: done ? 'line-through' : 'none' }}>
        {label}
      </Text>
    </View>
  );
})}
```

### Countdown Computation
```typescript
// Countdown from reset_timestamp to now
function formatCountdown(resetTimestamp: string): string {
  const diffMs = new Date(resetTimestamp).getTime() - Date.now();
  if (diffMs <= 0) return '0h 0m';
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// In component with setInterval for live update
const [countdown, setCountdown] = useState('');
useEffect(() => {
  if (!exhaustionData?.reset_timestamp) return;
  const update = () => setCountdown(formatCountdown(exhaustionData.reset_timestamp));
  update();
  const id = setInterval(update, 30000); // update every 30s
  return () => clearInterval(id);
}, [exhaustionData?.reset_timestamp]);
```

### GET /credits/balance Response Shape
```typescript
// Source: backend/api/src/routes/credits.ts lines 22-27 [VERIFIED: read directly]
{
  balance: number,
  daily_earned: number,
  daily_cap: number,        // DAILY_EARN_CAP = 4
  reset_timestamp: string,  // ISO — next UTC midnight
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Native Animated API | MotiView (moti) | Already in project | Simpler spring animations, less boilerplate |
| Prop drilling store data | Zustand global store | Project standard | creditStore follows same pattern as authStore, aiStore |

**No deprecated patterns identified** — all required patterns are current project standards.

---

## Exact File Inventory (Critical for Planning)

### Files to Create (NEW)
| File | Content |
|------|---------|
| `apps/mobile/src/stores/creditStore.ts` | Zustand store with balance, toast, exhaustion state |
| `apps/mobile/src/lib/creditCosts.ts` | `CREDIT_COSTS = { chat: 4, scan: 3, program: 4 } as const` |
| `apps/mobile/src/components/CreditEarnToast.tsx` | Floating toast, MotiView fade, 2.5s auto-dismiss |
| `apps/mobile/src/components/CreditExhaustionSheet.tsx` | Modal bottom sheet with earn list + countdown |

### Files to Modify (EXISTING)
| File | What Changes |
|------|-------------|
| `apps/mobile/app/_layout.tsx` | Mount `<CreditEarnToast />` and `<CreditExhaustionSheet />` after `<BugReportModal />` |
| `apps/mobile/app/(app)/ai/index.tsx` | (1) Import useCreditStore + CREDIT_COSTS; (2) Add balance chip to header; (3) Modify send button for cost label; (4) Add 402 detection in handleSend catch block |
| `plugins/gamification/src/screens/GamificationDashboard.tsx` | Add dual-balance card between level ring and XP bar (after line ~138) |
| `plugins/ai-programs/src/screens/GenerateProgram.tsx` | Add `{CREDIT_COSTS.program}⚡` to generate button text (line ~133) |
| `plugins/nutrition/src/screens/LogMealScreen.tsx` | Add `3⚡` label to scan buttons in scan tab (lines ~427-432) |
| `backend/api/src/middleware/creditGate.ts` | Add `earned_today: string[]` + `reset_timestamp` to 402 body |

### Cost Label Locations (precise)
- **AI Chat send button:** `apps/mobile/app/(app)/ai/index.tsx` — the `TouchableOpacity` at lines 318–334 (currently a 44x44 circle; must widen to pill shape)
- **Generate program button:** `plugins/ai-programs/src/screens/GenerateProgram.tsx` — the `TouchableOpacity` at lines 124–136 (already has `flexDirection: 'row'` and gap — just add cost text)
- **Vision scan buttons:** `plugins/nutrition/src/screens/LogMealScreen.tsx` — the two `TouchableOpacity` buttons at lines 427–432 (camera and gallery) in the scan tab. Cost label shows on both since either triggers the scan API call

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is entirely code/config changes. No new external tools, services, CLI utilities, or runtimes are required beyond the already-running project stack.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project — no jest.config.*, vitest.config.*, or test directories in project source |
| Config file | None — Wave 0 gap |
| Quick run command | Manual inspection + TypeScript check: `npm run type-check` |
| Full suite command | `npm run type-check` (across all packages) |

**Note:** This is a React Native / Expo project with no configured automated test framework at the project level. All test files found are in `node_modules`. Validation for this phase is TypeScript type-checking + manual smoke testing via Expo dev server.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-01 | Balance chip visible in AI chat header | Manual smoke | `npx expo start` + navigate to AI tab | N/A |
| CRED-01 | Dual-balance card in gamification dashboard | Manual smoke | `npx expo start` + navigate to gamification | N/A |
| CRED-04 | Cost label on send button shows "4⚡" | Manual smoke | `npx expo start` + AI chat screen | N/A |
| CRED-04 | Cost label on generate button shows "4⚡" | Manual smoke | `npx expo start` + AI Programs generate | N/A |
| CRED-04 | Cost label on scan button shows "3⚡" | Manual smoke | `npx expo start` + Nutrition scan tab | N/A |
| CRED-05 | Exhaustion sheet appears on 402 | Manual smoke | Trigger with zero-balance test account | N/A |
| CRED-05 | earned_today checkmarks render correctly | Manual smoke | Inspect 402 response body | N/A |
| EARN-08 | Toast appears after earn, auto-dismisses 2.5s | Manual smoke | Log an activity | N/A |
| EARN-09 | Sheet shows earn progress with checkmarks | Manual smoke | Exhaust credits then view sheet | N/A |
| TypeScript | No type errors in new files | Automated | `npm run type-check` | ✅ (existing script) |

### Sampling Rate
- **Per task commit:** `npm run type-check` from project root
- **Per wave merge:** `npm run type-check` + manual smoke on Expo dev server
- **Phase gate:** TypeScript green + all 5 smoke tests pass before `/gsd-verify-work`

### Wave 0 Gaps
- No new test files needed — this phase has no testable pure functions. TypeScript coverage is the automated gate.
- [ ] `apps/mobile/src/lib/creditCosts.ts` must export typed const matching backend `CREDIT_COSTS` — type-check will catch mismatches

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Balance fetch uses existing Supabase JWT via authStore session |
| V3 Session Management | no | No new session state introduced |
| V4 Access Control | no | creditGate.ts already enforces auth; no new endpoints |
| V5 Input Validation | no | No user input in new components (read-only display) |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Balance spoofing via client-side store | Tampering | Balance is display-only; deduction enforced server-side by creditGate.ts SECURITY DEFINER RPC — client balance is informational only |
| Stale balance shown post-earn | Information Disclosure | useFocusEffect re-fetches on every screen focus — at most one screen transition stale |
| 402 body leaking user activity patterns | Information Disclosure | earned_today only shows source strings ('workout', 'meal'), not record IDs or content — minimal PII exposure |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The MotiView `exit` prop is available in the installed `moti` version | Code Examples — CreditEarnToast | If exit prop not supported, use explicit `animate` with `opacity: 0` driven by store state instead |
| A2 | `pointerEvents: 'none'` on the toast container wrapper prevents tap-blocking | Code Examples — CreditEarnToast | If blocking taps, add `pointerEvents="none"` as JSX prop on the wrapping View |
| A3 | `Keyboard.dismiss()` reliably prevents Modal/keyboard overlap on both platforms | Pitfall 5 | If not reliable on Android, use `KeyboardAvoidingView` inside the Modal |

**All other claims are VERIFIED from direct codebase read.**

---

## Open Questions

1. **Should the balance chip in AI chat header navigate to gamification on tap?**
   - What we know: D-discretion area. The chip shows balance; gamification dashboard also shows balance.
   - What's unclear: Whether deep-linking from AI chat to gamification causes navigation stack issues with Expo Router.
   - Recommendation: Default to non-navigable chip (just a display label). Planner can add `router.push('/(plugins)/gamification/dashboard')` if desired.

2. **Exact ⚡ icon color: #FF5C1A (theme.primary) or gold #FFB800?**
   - What we know: CONTEXT.md lists this as Claude's discretion.
   - Recommendation: Gold/amber `#FFB800` for ⚡ since it visually distinguishes credits from the primary orange used for XP/levels. The primary color `#FF5C1A` is already heavily used; a distinct color makes credits easier to scan.

3. **Does earnCredits.ts need to return the credited result to enable showEarnToast()?**
   - What we know: `callCreditsEarn()` in `apps/mobile/src/lib/earnCredits.ts` is fire-and-forget — it does NOT return `credited`. It uses `fetch` without awaiting the response.
   - Critical gap: D-06 says "each screen checks `result.credited` and conditionally calls `showEarnToast()`". But `callCreditsEarn()` doesn't return the response. **The earn helper must be updated to return `{ credited: boolean }` or the screens must call a new awaitable version.**
   - Recommendation: Add a second exported function `callCreditsEarnResult()` that awaits the fetch and returns `{ credited: boolean }`. Screens that already use fire-and-forget `callCreditsEarn()` keep it; screens that want toast use the new version.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reads — all file paths [VERIFIED]
  - `backend/api/src/middleware/creditGate.ts` — 402 response shape confirmed
  - `backend/api/src/routes/credits.ts` — balance endpoint confirmed
  - `backend/api/src/services/creditService.ts` — earnCredits, getBalanceSummary confirmed
  - `backend/api/src/config/credits.ts` — CREDIT_COSTS = { chat: 4, scan: 3, program: 4 } confirmed
  - `apps/mobile/src/stores/aiStore.ts` — sendMessage error flow confirmed
  - `apps/mobile/src/stores/authStore.ts` — Zustand store pattern confirmed
  - `apps/mobile/src/lib/earnCredits.ts` — fire-and-forget, no return value confirmed
  - `apps/mobile/src/components/CustomAlert.tsx` — Modal + MotiView pattern confirmed
  - `apps/mobile/app/_layout.tsx` — mount point confirmed (line 70-71)
  - `apps/mobile/app/(app)/ai/index.tsx` — full screen structure confirmed
  - `packages/plugin-sdk/src/alert.ts` — useAlertStore pattern confirmed
  - `packages/ai-client/src/AIBridge.ts` — XHR 402 rejection message format confirmed
  - `plugins/gamification/src/screens/GamificationDashboard.tsx` — hero section structure confirmed
  - `plugins/ai-programs/src/screens/GenerateProgram.tsx` — generate button structure confirmed
  - `plugins/nutrition/src/screens/LogMealScreen.tsx` — scan tab + pickImage buttons confirmed
  - `plugins/supplements/src/screens/SupplementsListScreen.tsx` — useFocusEffect pattern confirmed

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (D-01 through D-13) — user-locked decisions from /gsd-discuss-phase session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in project
- Architecture patterns: HIGH — exact file paths and line numbers verified by direct read
- Pitfalls: HIGH — identified from actual code structure, not heuristics
- Open Questions: HIGH — based on real gaps found in earnCredits.ts return type

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable project, no fast-moving dependencies)
