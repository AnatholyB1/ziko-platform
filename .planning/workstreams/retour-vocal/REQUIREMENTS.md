# Requirements: v1.9 Retour Vocal Coach

**Workstream:** `retour-vocal`
**Milestone:** v1.9
**Goal:** Le coach enregistre un retour vocal sur un athlète → Whisper transcrit → Claude nettoie et structure avec la mémoire long terme de l'athlète → résumé exploitable livré au coach.

**Done criterion:** Guillaume fait son premier retour vocal sur Joaquim et reçoit une card structurée exploitable.

---

## Active Requirements

### VOICE — Enregistrement & Transcription

- [ ] **VOICE-01**: Coach peut démarrer/arrêter un enregistrement audio (mic browser, max 5 min) depuis la fiche client web CRM
- [ ] **VOICE-02**: Audio uploadé au serveur et transcrit via OpenAI Whisper API (`whisper-1`, FR/EN)
- [ ] **VOICE-03**: Transcript affiché en lecture seule avant la structuration — le coach peut valider ou relancer

### STRUCT — Structuration Claude

- [ ] **STRUCT-01**: Claude reçoit le transcript + contexte complet de l'athlète : dernières 10 séances (poids, reps, RPE), mesures récentes, scores sommeil, notes coach privées, historique feedbacks vocaux
- [ ] **STRUCT-02**: Output : card structurée en 5 sections — Contexte séance, Points forts, Corrections, Next steps, Tags automatiques (force / technique / mental / cardio / récupération)
- [ ] **STRUCT-03**: Coach peut éditer la card avant de sauvegarder

### MEM — Mémoire long terme

- [ ] **MEM-01**: Feedback structuré sauvegardé en base (`coach_vocal_feedbacks`) avec timestamp, athlète, transcript brut et card JSON
- [ ] **MEM-02**: Les N feedbacks précédents de l'athlète sont injectés dans le contexte Claude lors de la structuration (mémoire long terme)
- [ ] **MEM-03**: Historique des feedbacks vocaux accessible depuis la fiche client (onglet dédié ou section)

---

## Deferred (post-v1.9)

- Partage du feedback à l'athlète (email ou notification push)
- Synthèse mensuelle automatique par athlète
- Cross-context coach (comparaison inter-athlètes) — scope trop large pour 2-3j
- Export PDF du feedback

---

## Out of Scope

- Mobile coach (Expo) — surface web uniquement pour ce workstream
- Commandes vocales (STT pour interface) — différent du retour vocal coach
- Temps réel (streaming Whisper) — batch upload suffit pour le use case
- Groq/Vercel AI SDK Whisper — OpenAI Whisper API direct retenu

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| VOICE-01 | Phase 01 | pending |
| VOICE-02 | Phase 01 | pending |
| VOICE-03 | Phase 01 | pending |
| STRUCT-01 | Phase 02 | pending |
| STRUCT-02 | Phase 02 | pending |
| STRUCT-03 | Phase 02 | pending |
| MEM-01 | Phase 03 | pending |
| MEM-02 | Phase 03 | pending |
| MEM-03 | Phase 03 | pending |
