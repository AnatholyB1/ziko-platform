# Requirements — v1.13 Retour Vidéo Coach

**Workstream:** retour-video
**Milestone:** v1.13
**Generated:** 2026-05-26
**Coverage:** 100% — all selected features captured

---

## v1.13 Requirements

### Upload Vidéo (Mobile)

- [ ] **UPLOAD-01**: L'athlète peut sélectionner une vidéo depuis sa galerie OU enregistrer directement depuis la caméra via expo-image-picker
- [ ] **UPLOAD-02**: L'upload affiche une barre de progression (XMLHttpRequest avec events de progression — fichiers 50–500 MB)
- [ ] **UPLOAD-03**: L'athlète peut saisir un titre/label avant l'upload (ex: "Squat dos 2026-05-26")
- [ ] **UPLOAD-04**: Le coach reçoit une notification push quand une nouvelle vidéo est disponible

### Infrastructure & Storage

- [ ] **INFRA-01**: Bucket Supabase `coach-videos` créé avec path convention `{athleteId}/{videoId}.mp4` et RLS basée sur `is_coach_of()`
- [ ] **INFRA-02**: Vidéo exportée en H.264/MP4 (pas HEVC) via `videoExportPreset` au niveau du picker mobile — compatibilité Chrome/Firefox coach garantie
- [ ] **INFRA-03**: Upload via signed URL PUT (pattern existant storage.ts) — Vercel 4.5 MB limit contournée, Hono metadata-only
- [ ] **INFRA-04**: Migration SQL `coach_client_videos` (id, athlete_id, coach_id, storage_path, title, duration_s, created_at, status) + `coach_video_annotations` (id, video_id, coach_id, timestamp_s, type [text|voice], content, audio_path, created_at)

### Player & Annotations Texte (Web)

- [ ] **PLAYER-01**: Le coach voit un onglet "Vidéos" (9ème tab dans la vue client detail) listant les vidéos uploadées par l'athlète avec titre, date et statut
- [ ] **PLAYER-02**: Le coach peut lire une vidéo avec scrubbing complet via `@vidstack/react` — lecture, pause, seek, barre de progression
- [ ] **ANNOT-01**: Le coach peut mettre en pause et créer une annotation texte timecodée — marker coloré sur la timeline au timestamp précis
- [ ] **ANNOT-02**: Le coach peut modifier ou supprimer ses annotations existantes
- [ ] **ANNOT-03**: Un panel latéral liste toutes les annotations triées par timestamp — clic sur une annotation → seek vers ce moment

### Lecture Annotations (Mobile — Athlète)

- [ ] **REVIEW-01**: L'athlète peut ouvrir ses vidéos uploadées depuis mobile et voir les markers d'annotations sur la timeline
- [ ] **REVIEW-02**: L'athlète peut tapper sur un marker pour seek vers le timestamp de l'annotation et lire le commentaire (texte + transcript vocal)

### Annotations Vocales (Web)

- [ ] **VOICE-01**: Le coach peut enregistrer un commentaire vocal sur une annotation via MediaRecorder Web API (bouton record dans le composer d'annotation)
- [ ] **VOICE-02**: Le commentaire vocal est transcrit via Whisper et nettoyé via Claude — nouvelle route indépendante `POST /coach/video/annotation/transcribe` partageant `lib/whisper.ts` sans modifier la route retour-vocal v1.9
- [ ] **VOICE-03**: Le blob audio est stocké dans `coach-videos/annotations/` et le transcript est sauvegardé en DB — MIME type passé explicitement à Whisper (WebM/Opus Chrome, MP4/AAC Safari)
- [ ] **VOICE-04**: Le player audio du commentaire vocal est accessible inline dans le panel d'annotations latéral

---

## Future Requirements (déférés post-v1.13)

- Retour vidéo webcam coach (coach enregistre et envoie une vidéo) → v1.x+1 (explicitement hors scope)
- Telestration / annotations dessinées sur la vidéo → post-v1.13
- Transcription automatique complète de la vidéo athlète → post-v1.13
- Upload resumable TUS (pour fichiers > 500 MB) → post-v1.13 si besoin confirmé
- Miniatures vidéo (thumbnail génération via FFmpeg WASM) → post-v1.13
- Partage vidéo entre coachs → post-v1.13

---

## Out of Scope

| Feature | Raison |
|---------|--------|
| Retour vidéo webcam coach | Explicitement reporté v1.x+1 par décision utilisateur |
| Dark mode player | Light sport theme only — aucun dark mode dans Ziko |
| Transcoding pipeline | Vercel serverless incompatible avec FFmpeg — H.264 enforcement côté mobile |
| Side-by-side comparison | Complexité injustifiée pour 1:1 coaching en v1 |
| AI form detection / analyse posturale | Hors scope — annotation manuelle dans ce milestone |

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| UPLOAD-01 | Phase 45 | Pending |
| UPLOAD-02 | Phase 45 | Pending |
| UPLOAD-03 | Phase 45 | Pending |
| UPLOAD-04 | Phase 45 | Pending |
| INFRA-01 | Phase 45 | Pending |
| INFRA-02 | Phase 45 | Pending |
| INFRA-03 | Phase 45 | Pending |
| INFRA-04 | Phase 45 | Pending |
| PLAYER-01 | Phase 46 | Pending |
| PLAYER-02 | Phase 46 | Pending |
| ANNOT-01 | Phase 46 | Pending |
| ANNOT-02 | Phase 46 | Pending |
| ANNOT-03 | Phase 46 | Pending |
| REVIEW-01 | Phase 46 | Pending |
| REVIEW-02 | Phase 46 | Pending |
| VOICE-01 | Phase 47 | Pending |
| VOICE-02 | Phase 47 | Pending |
| VOICE-03 | Phase 47 | Pending |
| VOICE-04 | Phase 47 | Pending |

---

*Created: 2026-05-26 — Milestone v1.13 Retour Vidéo Coach*
