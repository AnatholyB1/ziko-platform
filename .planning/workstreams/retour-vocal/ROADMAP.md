# Roadmap: v1.9 Retour Vocal Coach

**Workstream:** `retour-vocal`
**Milestone:** v1.9
**Granularity:** Standard
**Coverage:** 9/9 requirements mapped

---

## Phases

- [ ] **Phase 01: Transcription Pipeline** - Coach records audio, server transcribes via Whisper, transcript displayed for validation
- [ ] **Phase 02: Claude Structuring** - Claude receives full athlete context + transcript, produces 5-section structured card, coach can edit before saving
- [ ] **Phase 03: Persistence & Memory** - Structured feedback saved to DB, injected as long-term memory into future Claude calls, history accessible from client sheet

---

## Phase Details

### Phase 01: Transcription Pipeline
**Goal**: Coach can record a vocal feedback and read the transcript before structuring
**Depends on**: Nothing (first phase)
**Requirements**: VOICE-01, VOICE-02, VOICE-03
**Success Criteria** (what must be TRUE):
  1. Coach can press a record button on the client sheet, speak for up to 5 minutes, and stop recording — all from the browser
  2. After stopping, the audio is uploaded and Whisper returns a French/English transcript within a few seconds
  3. The transcript appears on screen in read-only mode with options to validate or re-record
  4. The Hono route `POST /coach/voice/transcribe` accepts audio blob and returns the transcript text
**Plans**: TBD

### Phase 02: Claude Structuring
**Goal**: Coach receives a structured, editable 5-section feedback card generated from the transcript and athlete context
**Depends on**: Phase 01
**Requirements**: STRUCT-01, STRUCT-02, STRUCT-03
**Success Criteria** (what must be TRUE):
  1. After validating the transcript, Claude receives the last 10 sessions (weight, reps, RPE), recent measurements, sleep scores, private coach notes, and previous vocal feedback history
  2. Claude returns a card with exactly 5 sections: Contexte séance, Points forts, Corrections, Next steps, and auto-tags (force / technique / mental / cardio / récupération)
  3. Coach can edit any section of the card inline before saving
  4. The Hono route `POST /coach/voice/structure` accepts transcript + athlete context and returns the structured card JSON
**Plans**: TBD
**UI hint**: yes

### Phase 03: Persistence & Memory
**Goal**: Structured feedbacks are saved, browsable from the client sheet, and injected into future Claude structuring calls
**Depends on**: Phase 02
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):
  1. After saving, the feedback (timestamp, athlete ID, raw transcript, card JSON) is persisted in `coach_vocal_feedbacks` and survives a page reload
  2. When a coach structures a new vocal feedback, the N most recent feedbacks for that athlete are automatically injected into the Claude context
  3. Coach can open the client sheet and browse all past vocal feedbacks in a dedicated tab or section, sorted by date
**Plans**: TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. Transcription Pipeline | 0/? | Not started | - |
| 02. Claude Structuring | 0/? | Not started | - |
| 03. Persistence & Memory | 0/? | Not started | - |

---

## Coverage Validation

| REQ-ID | Phase | Rationale |
|--------|-------|-----------|
| VOICE-01 | Phase 01 | Browser mic recording UI |
| VOICE-02 | Phase 01 | Upload + Whisper transcription route |
| VOICE-03 | Phase 01 | Transcript display + validate/re-record |
| STRUCT-01 | Phase 02 | Athlete context assembly for Claude |
| STRUCT-02 | Phase 02 | 5-section card output |
| STRUCT-03 | Phase 02 | Inline card editing before save |
| MEM-01 | Phase 03 | DB persistence (`coach_vocal_feedbacks`) |
| MEM-02 | Phase 03 | Historical feedbacks injected into Claude context |
| MEM-03 | Phase 03 | History view in client sheet |

Coverage: 9/9 v1 requirements mapped. No orphans.
