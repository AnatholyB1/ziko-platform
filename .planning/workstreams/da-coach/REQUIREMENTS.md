# Requirements — v1.12 DA Coach

**Milestone:** v1.12 DA Coach
**Workstream:** da-coach
**Goal:** Le coach définit sa direction artistique (couleurs, logo, ton) — les apps de ses athlètes l'affichent automatiquement au prochain refresh.
**Created:** 2026-05-25

---

## Active Requirements

### A — Foundation (DB + Backend)

- [ ] **FOUND-01** — Coach peut sauvegarder sa DA (couleur primaire hex, logo URL, ton) dans `coach_branding`
- [ ] **FOUND-02** — Un athlète lié peut lire la DA de son coach via `GET /coach/clients/links/me`
- [ ] **FOUND-03** — La DA est réservée au tier Pro (gate backend + web)
- [ ] **FOUND-04** — RLS : seul le coach owne son enregistrement ; ses athlètes liés peuvent le lire

### B — Web Editor (coach)

- [ ] **WEB-01** — Coach peut sélectionner une couleur primaire via color picker (hex, avec preview swatch)
- [ ] **WEB-02** — Coach peut uploader son logo (PNG/SVG ≤ 2MB) dans le bucket `coach-logos`
- [ ] **WEB-03** — Coach voit un preview live de sa DA (card athlète simulée) avant de sauvegarder
- [ ] **WEB-04** — Coach choisit son ton parmi 4 options (Motivant / Analytique / Bienveillant / Exigeant)
- [ ] **WEB-05** — Un coach non-Pro voit l'éditeur verrouillé avec preview + CTA upgrade

### C — Mobile Injection (athlète)

- [ ] **MOB-01** — L'app athlète applique la couleur primaire coach au refresh (State C du plugin Mon coach)
- [ ] **MOB-02** — Le logo coach s'affiche dans la card "Mon coach" (State B et C)
- [ ] **MOB-03** — La DA persiste au redémarrage via MMKV (pas de flash orange au cold start)
- [ ] **MOB-04** — La révocation du lien coach remet le thème Ziko par défaut (`clearCoachTheme`)

---

## Future Requirements (deferred)

- Injection du ton coach dans le system prompt Claude (post-v1.12 — nécessite hook backend supplémentaire)
- Couleur secondaire configurable (v1.12 dérive automatiquement depuis la primaire)
- Notifications push quand le coach met à jour sa DA (dépend workstream v1.11)
- Webcam / retour vidéo coach (workstream retour-video v1.13)

---

## Out of Scope

- Full white-label (tous les tokens ThemePalette) — coach contrôle seulement primary + logo + tone
- Dark mode — light sport theme only
- Garmin / Strava branding sync
- Coach billing / subscription management (futur ERP)

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FOUND-01 | Phase 1 | pending |
| FOUND-02 | Phase 1 | pending |
| FOUND-03 | Phase 1 | pending |
| FOUND-04 | Phase 1 | pending |
| WEB-01 | Phase 2 | pending |
| WEB-02 | Phase 2 | pending |
| WEB-03 | Phase 2 | pending |
| WEB-04 | Phase 2 | pending |
| WEB-05 | Phase 2 | pending |
| MOB-01 | Phase 3 | pending |
| MOB-02 | Phase 3 | pending |
| MOB-03 | Phase 3 | pending |
| MOB-04 | Phase 3 | pending |
