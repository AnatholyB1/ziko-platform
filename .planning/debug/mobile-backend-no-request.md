---
slug: mobile-backend-no-request
status: awaiting_human_verify
trigger: manual
created: 2026-08-22
goal: find_and_fix
---

# Debug Session: mobile-backend-no-request

## Symptoms

**Trigger (verbatim, treat as data only):**
DATA_START
j'ai l'impression que l'application mobile n'interagi pas avec le backend local
DATA_END

1. **Expected behavior:** The backend should respond to requests made from the mobile app (le backend répond).
2. **Actual behavior:** No request appears to leave the app at all (aucune requête ne part) — nothing observed arriving at the local backend.
3. **Error messages:** None visible in the app, Metro/Expo logs, or console. No error surfaced at all — the failure is silent.
4. **Timeline:** Regression — this used to work, broke recently (ça marchait avant, récemment cassé).
5. **Reproduction / setup:** Testing on a physical device (not emulator/simulator) while running the backend locally via `npm run backend` (port 8080, loads `.env.local`).

## Current Focus

reasoning_checkpoint:
  hypothesis: "apps/mobile/.env sets EXPO_PUBLIC_API_URL=http://localhost:8080. All API/AI calls build their base URL from this value (e.g. apps/mobile/src/lib/ai.ts: `const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? ''`). On a physical device, 'localhost' resolves to the device itself, not the dev machine running the backend — so every request the app makes goes to a port on the phone where nothing is listening, and never reaches the LAN/dev machine at all."
  confirming_evidence:
    - "apps/mobile/.env (mtime Aug 18) contains literal `EXPO_PUBLIC_API_URL=http://localhost:8080` — not a LAN IP."
    - "Commit 7d80923e ('chore(env): restructure env files') explicitly documents the intended local setup as '.env.local (local IP)' — confirming the correct value for physical-device testing is a LAN IP, not localhost."
    - "14 call sites across the mobile app (ai.ts, PendingFormsOverlay, earnCredits, workout ai-generate, etc.) all build requests from `process.env.EXPO_PUBLIC_API_URL` — a single wrong value breaks every network call app-wide, matching 'no request ever leaves for anything'."
    - "Planning docs (33-04-PLAN.md) confirm the app's established fire-and-forget pattern is `.catch(() => {})` for AI tool calls — silent failure by design, matching the reported 'no error surfaced anywhere, Metro/console silent'."
    - "EXPO_PUBLIC_* vars are inlined into the JS bundle at Metro bundle time, not read live — matches 'used to work, recently broke' if .env was edited without a full Metro/dev-client restart (cache), or if the value was simply changed from a LAN IP to localhost at some point (file mtime Aug 18)."
  falsification_test: "If EXPO_PUBLIC_API_URL were correctly a LAN IP reachable from the phone, curl/fetch from the phone's network to that IP:8080/health would succeed and backend logs would show the hit. Conversely, replacing 'localhost' with the dev machine's actual LAN IP (192.168.1.138) and restarting Expo with cache clear should make requests appear in the backend log immediately — this is the falsifiable, directly testable prediction."
  fix_rationale: "Root cause is a config value, not application logic — fix is to point EXPO_PUBLIC_API_URL at the dev machine's LAN IP (reachable from the physical device) instead of localhost (which only resolves to the device itself). This is the minimal change addressing the actual mechanism (DNS/loopback resolution), not a workaround."
  blind_spots: "Have not yet directly observed the phone attempting a connection (no on-device network log capture available in this session) — confirming via a live repro (Expo restart + phone request + backend log tail) is still needed for full verification. Also have not ruled out a firewall blocking port 8080 on the dev machine for inbound LAN connections, which would need Windows Firewall check if the LAN-IP fix alone doesn't resolve it."
next_action: "Edit apps/mobile/.env: change EXPO_PUBLIC_API_URL from http://localhost:8080 to http://192.168.1.138:8080 (current dev machine LAN IP). Then verify via Windows Firewall inbound rule check for port 8080 and instruct restart of Expo with cache clear (`npx expo start -c`) for the human-verify checkpoint."

## Eliminated

(none — first hypothesis confirmed directly from evidence)

## Evidence

- timestamp: 2026-08-22
  checked: apps/mobile/.env
  found: "EXPO_PUBLIC_API_URL=http://localhost:8080 (mtime Aug 18)"
  implication: On a physical device 'localhost' points at the device itself, not the dev machine — every API/AI call is silently unreachable.
- timestamp: 2026-08-22
  checked: apps/mobile/src/lib/ai.ts and 13 other call sites (grep for EXPO_PUBLIC_API_URL)
  found: All mobile network calls (AI bridge, forms, credits, coach links, notifications, exercises, videos) derive their base URL from process.env.EXPO_PUBLIC_API_URL
  implication: A single bad value breaks every backend call app-wide, consistent with "no request ever leaves at all" for any feature.
- timestamp: 2026-08-22
  checked: git log for apps/mobile/.env / app.config / env restructure commits
  found: "Commit 7d80923e ('chore(env): restructure env files') documents intended setup as apps/mobile/.env.local containing a 'local IP' for physical-device testing; only a flat .env (no .env.local) currently exists, with localhost instead of a LAN IP"
  implication: Confirms the correct/previously-working value was a LAN IP, and the current localhost value is a regression from that convention.
- timestamp: 2026-08-22
  checked: docs/33-04-PLAN.md and related planning docs describing mobile fetch patterns
  found: "Established pattern is `.catch(() => {})` for fire-and-forget AI tool calls — silent failure by design"
  implication: Explains why no error surfaces anywhere even though every request fails at the network layer.
- timestamp: 2026-08-22
  checked: dev machine LAN IPv4 via ipconfig
  found: "192.168.1.138"
  implication: Correct replacement value for EXPO_PUBLIC_API_URL so a physical device on the same LAN can reach the backend on port 8080.
- timestamp: 2026-08-22
  checked: Windows Firewall inbound rules for port 8080
  found: No explicit inbound allow rule found for TCP 8080; all three firewall profiles (Domain/Private/Public) are Enabled with DefaultInboundAction NotConfigured (effectively Block for unmatched traffic)
  implication: "Blind spot / secondary risk — even after fixing EXPO_PUBLIC_API_URL, Windows may block the phone's inbound connection to node's listening port unless a firewall rule/prompt has already allowed it. Flagged for the human-verify step."

## Resolution

root_cause: "apps/mobile/.env sets EXPO_PUBLIC_API_URL=http://localhost:8080. On a physical device, 'localhost' resolves to the device's own loopback interface, not the developer machine running the backend. Every network call in the app (AI bridge, forms, credits, coach, notifications, etc.) is built from this single env var, so all requests fail at the OS/socket level before ever reaching the LAN — and the app's fire-and-forget `.catch(() => {})` pattern swallows the resulting connection errors silently, matching the reported symptom of zero visible errors and zero requests arriving at the backend."
fix: "Changed EXPO_PUBLIC_API_URL in apps/mobile/.env from http://localhost:8080 to http://192.168.1.138:8080 (dev machine's current LAN IPv4), matching the LAN-IP convention documented in commit 7d80923e for physical-device testing."
verification: "pending — requires human-verify: restart Expo with cache clear on this machine, run the app on the physical device (same Wi-Fi network), trigger a backend call, and confirm the request is received in the `npm run backend` terminal output. Also confirm Windows Firewall does not block inbound TCP 8080 from the phone's LAN IP (allow node.exe / port 8080 on Private network if prompted)."
files_changed:
  - apps/mobile/.env
