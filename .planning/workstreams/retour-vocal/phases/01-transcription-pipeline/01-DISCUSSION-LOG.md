# Phase 01: Transcription Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 01-Transcription Pipeline
**Areas discussed:** Entry point fiche client, UX affichage transcript, Langue Whisper

---

## Entry point fiche client

| Option | Description | Selected |
|--------|-------------|----------|
| Nouvel onglet 'Retour vocal' | 9e onglet dans ClientTabStrip, page dédiée vocal/page.tsx, Phase 03 y loge l'historique sans refactoring | ✓ |
| Bouton inline onglet Séances | Plus contextuel mais complexifie la page sessions et Phase 03 | |

**User's choice:** Nouvel onglet "Retour vocal"
**Notes:** Choix aligné avec Phase 03 (historique au même endroit). Empty state = bouton micro centré seul, sans anticiper la structure Phase 03.

| Option | Description | Selected |
|--------|-------------|----------|
| Gros bouton micro centré | Empty state simple, rien d'autre | ✓ |
| Header + bouton + placeholder historique | Anticipe Phase 03 mais ajoute complexité inutile maintenant | |

**User's choice:** Gros bouton micro centré

---

## UX affichage transcript

| Option | Description | Selected |
|--------|-------------|----------|
| Inline — étapes progressives | 4 états sur la même page : idle → recording → transcribing → review | ✓ |
| Modal / Slide-over | Slide-over s'ouvre, SessionSlideOver.tsx comme pattern de référence | |

**User's choice:** Inline progressif
**Notes:** 4 états définis — idle, recording (chrono), transcribing (spinner), review (transcript + Valider/Relancer)

| Option | Description | Selected |
|--------|-------------|----------|
| Upload annulé, re-record requis | Warning beforeunload si en cours, upload interrompu si on quitte | ✓ |
| Upload en background | Service Worker ou état persistant — complexité significative | |

**User's choice:** Upload annulé, re-record requis

| Option | Description | Selected |
|--------|-------------|----------|
| Message d'erreur + Relancer | Erreur inline, audio encore en mémoire, boutons Ressayer et Relancer | ✓ |
| Re-record forcé | Retour immédiat à idle sans feedback | |

**User's choice:** Message d'erreur inline + Ressayer/Relancer

---

## Langue Whisper

| Option | Description | Selected |
|--------|-------------|----------|
| FR forcé — `language: 'fr'` | Plus rapide, meilleure précision pour les feedbacks de Guillaume en français | ✓ |
| Auto-detect FR/EN | Aucun paramètre language — utile pour athlètes anglophones, légèrement plus lent | |

**User's choice:** `language: 'fr'` forcé
**Notes:** Guillaume coache principalement en français. Auto-detect non requis pour v1.9.

---

## Claude's Discretion

- Format exact du bloc transcript dans l'état `review` (padding, fond, scroll)
- Chronomètre : format `mm:ss`, couleur rouge > 4 min
- Nom du fichier envoyé à Whisper (`recording.webm` ou autre)
- Comportement exact après "Relancer" dans l'état `review` (→ `recording` ou → `idle`)

## Deferred Ideas

- Streaming Whisper temps réel — explicitement exclu des REQUIREMENTS
- Auto-detect FR/EN — rejeté en faveur de FR forcé
- Section historique anticipée dans l'onglet — repoussée en Phase 03
