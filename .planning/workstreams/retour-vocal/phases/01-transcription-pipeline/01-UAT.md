---
status: complete
phase: 01-transcription-pipeline
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-05-27T00:00:00Z
updated: 2026-05-27T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running dev servers. Start the backend API fresh (`npm run backend` from project root or `npm run dev` from backend/api/). Server boots without errors. Then start the web dev server (`npm run mobile` or from apps/web/). Navigate to any client sheet in the coach app — the app loads without console errors related to voice/vocal routes.
result: pass

### 2. "Retour vocal" tab visible in client profile
expected: Open a client sheet in the coach web app. The tab strip shows a "Retour vocal" tab (9th tab). Clicking it navigates to the vocal page without a 404 or white screen.
result: pass

### 3. Idle state UI
expected: On the "Retour vocal" tab, the page shows the idle state: a mic icon circle, a heading, and an orange "Nouveau retour" button. A GSAP entrance animation plays on load (elements fade/slide in).
result: pass

### 4. Starting a recording
expected: Click "Nouveau retour". The browser requests microphone permission. After granting, the UI transitions to the recording state: a red pulsing stop button appears and a timer starts counting from 00:00.
result: pass

### 5. Timer counts up during recording
expected: While recording, the timer increments each second (00:01, 00:02…). At ≥4:00 (240s), the timer text turns red as a visual warning. The stop button remains active.
result: pass

### 6. Stopping recording → transcribing state
expected: Click the stop button. UI transitions to the transcribing state: a spinner (orange animated ring) appears with French copy "Transcription…". This state is shown while the audio is being sent to the backend.
result: pass

### 7. Transcript review state (requires OPENAI_API_KEY set in backend/api/.env)
expected: After transcription completes, the UI transitions to review state: the transcript text is displayed in a scrollable muted background block. Two buttons are visible: "Valider" and "Relancer". (Skip this test if OPENAI_API_KEY is not configured.)
result: pass

### 8. Error state UI
expected: When Whisper fails (simulate by temporarily removing OPENAI_API_KEY or sending an invalid audio), the UI shows an error state: an AlertTriangle icon, an error message, and two buttons: "Ressayer" (retry with same blob) and "Relancer" (re-record). (Skip if you can't simulate an error.)
result: pass

### 9. beforeunload guard
expected: Start a recording, then try to navigate away or close the tab. The browser shows a native warning: "Enregistrement en cours. Quitter annulera le retour." The user can choose to stay or leave.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
