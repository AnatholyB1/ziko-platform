# Phase 01: Transcription Pipeline - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Coach appuie sur un bouton micro dans la fiche client web (onglet dédié "Retour vocal"), enregistre un audio max 5 min depuis le microphone du navigateur, l'audio est uploadé au serveur Hono, transcrit via OpenAI Whisper-1 (`language: 'fr'`), et le transcript est affiché inline en lecture seule avec deux actions : Valider ou Relancer.

La phase se termine quand le transcript est validé — aucune persistance, aucune structuration Claude dans cette phase.

</domain>

<decisions>
## Implementation Decisions

### Entry point — Fiche client

- **D-01:** Nouvel onglet "Retour vocal" ajouté dans `ClientTabStrip.tsx` (9e onglet). Page dédiée : `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx`.
- **D-02:** État initial (empty state) : bouton micro centré seul — pas de section historique anticipée (Phase 03 s'en chargera).

### UX — Machine à états inline

- **D-03:** 4 états inline sur la même page, sans modal :
  - `idle` → bouton "Nouveau retour"
  - `recording` → bouton "Arrêter" avec chronomètre
  - `transcribing` → spinner "Transcription…"
  - `review` → bloc transcript en lecture seule + [Valider] + [Relancer]
- **D-04:** Si le coach quitte l'onglet pendant l'enregistrement → warning `beforeunload` ("Enregistrement en cours. Quitter annulera le retour." + [Rester] / [Quitter quand même]). Si pendant la transcription → upload interrompu, pas de récupération, retour à `idle`.
- **D-05:** Si Whisper échoue → message d'erreur inline + bouton [Ressayer] (l'audio blob reste en mémoire tant que la page n'est pas rafraîchie) + bouton [Relancer] pour ré-enregistrer.

### Whisper — Langue

- **D-06:** `language: 'fr'` forcé dans l'appel Whisper-1. Aucune auto-détection. Optimisé pour les feedbacks en français de Guillaume.

### Backend — Route

- **D-07:** Nouvelle route Hono : `POST /coach/voice/transcribe`. Module `backend/api/src/coach/voice/service.ts` monté via `app.route('/coach/voice', voiceRouter)` dans `app.ts`. Pattern identique aux autres modules coach (`auth`, `clients`, `programs`, `imports`, `ai`).
- **D-08:** Payload : `multipart/form-data` avec le blob audio (webm/opus depuis MediaRecorder navigateur) — Whisper-1 accepte webm nativement, aucune conversion serveur nécessaire.

### Claude's Discretion

- Format exact du bloc transcript dans l'état `review` (padding, fond grisé, scroll si long…)
- Gestion du chronomètre (format `mm:ss`, couleur rouge > 4 min, etc.)
- Nommage exact du fichier envoyé à Whisper (ex: `recording.webm`)
- Gestion de l'état `review` après un "Relancer" (retour direct à `recording` ou `idle`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fiche client — Structure existante
- `apps/web/src/components/coach/ClientTabStrip.tsx` — Tableau TABS à modifier pour ajouter l'onglet "Retour vocal"
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — Layout wrappant tous les onglets (header + notes panel + tab panel)

### Backend — Pattern modules coach
- `backend/api/src/app.ts` — Point d'entrée des routes ; `app.route('/coach/voice', voiceRouter)` à ajouter
- `backend/api/src/coach/ai/service.ts` — Référence de pattern pour un module coach (auth middleware, structure Hono)
- `backend/api/src/middleware/auth.ts` — Auth middleware utilisé par tous les modules coach

### Requirements
- `.planning/workstreams/retour-vocal/REQUIREMENTS.md` — Requirements VOICE-01, VOICE-02, VOICE-03 pour cette phase
- `.planning/workstreams/retour-vocal/ROADMAP.md` — Success criteria phase 01

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ClientTabStrip.tsx` : array `TABS` statique à étendre — pattern simple, pas de logique dynamique
- `SessionSlideOver.tsx` : composant slide-over existant — non utilisé ici (on a choisi inline), mais utile comme référence de pattern pour les états multi-step
- Auth middleware (`authMiddleware`) : déjà importé dans tous les modules coach — identique pour la route voice

### Established Patterns
- Modules coach : `coach/{feature}/service.ts` → export `router` Hono → monté dans `app.ts`
- Pages client : thin wrapper `app/(coach)/coach/clients/[id]/{tab}/page.tsx` qui charge un composant client lourd
- CORS déjà configuré globalement dans `app.ts` — pas à reconfigurer dans le module voice

### Integration Points
- `ClientTabStrip.tsx` → ajouter `{ key: 'vocal', label: 'Retour vocal' }` dans `TABS`
- `app.ts` → `import { voiceRouter } from './coach/voice/service.js'` + `app.route('/coach/voice', voiceRouter)`
- Onglet vocal → `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx`

</code_context>

<specifics>
## Specific Ideas

- Mockup de l'état `review` montré pendant la discussion :
  ```
  ┌────────────────────────────────┐
  │ « Joaquim a bien poussé sur    │
  │ le squat aujourd'hui... »      │
  │                                │
  │  [ Valider ]   [ Relancer ]    │
  └────────────────────────────────┘
  ```
- Warning `beforeunload` avec texte exact : "Enregistrement en cours. Quitter annulera le retour."

</specifics>

<deferred>
## Deferred Ideas

- Partage du feedback à l'athlète (email / push) — post-v1.9
- Export PDF du feedback — post-v1.9
- Streaming Whisper (temps réel) — explicitement exclu des REQUIREMENTS
- Gestion multi-langue (auto-detect FR/EN) — exclu, FR forcé retenu

</deferred>

---

*Phase: 01-Transcription Pipeline*
*Context gathered: 2026-05-25*
