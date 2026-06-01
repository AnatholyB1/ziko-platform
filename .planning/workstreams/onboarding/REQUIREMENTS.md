# Requirements — Coach Onboarding Import IA (v1.0)

**Workstream:** onboarding  
**Milestone:** v1.0  
**Last updated:** 2026-05-29

---

## Active Requirements

### WIZARD — Intégration dans le wizard existant

- [ ] **WIZARD-01**: Le coach voit 4 steps dans `WizardProgress` au lieu de 3
- [ ] **WIZARD-02**: `WizardStep3Kyc.onSuccess` redirige vers `?step=4` au lieu du dashboard
- [ ] **WIZARD-03**: `OnboardingWizard` monte `WizardStep4Import` quand `step === 4`

### UPLOAD — Upload de fichiers

- [x] **UPLOAD-01**: Le coach peut uploader jusqu'à 4 fichiers (PDF, Excel, Word) depuis Step 4
- [x] **UPLOAD-02**: L'IA ouvre la conversation avec un message d'invite explicite ("Envoie-moi tes docs…")
- [x] **UPLOAD-03**: Chaque fichier sélectionné déclenche automatiquement le pipeline Phase 28 (create → upload → status → parse)

### PARSE — Orchestration et classification IA

- [ ] **PARSE-01**: L'IA identifie le type de chaque doc parsé (DA coach / template programme / données client)
- [ ] **PARSE-02**: L'IA affiche un résumé de ce qu'elle a compris pour chaque doc analysé
- [ ] **PARSE-03**: L'IA pose une question de clarification si le type d'un doc est ambigu

### REVIEW — Confirmation avant commit

- [ ] **REVIEW-01**: Le coach voit un résumé consolidé de tous les docs analysés avant toute action définitive
- [ ] **REVIEW-02**: Le coach peut corriger le type d'un doc (ex : "c'est un template, pas une DA")
- [ ] **REVIEW-03**: Les docs de type `coach_template` sont commités via `PUT /coach/imports/:id/commit` après confirmation

### COMPLETE — Fin de step

- [ ] **COMPLETE-01**: Un bouton "Ignorer pour l'instant" permet de quitter Step 4 et d'aller au dashboard sans importer
- [ ] **COMPLETE-02**: Après confirmation et commit, le coach est redirigé vers `/coach/dashboard`

---

## Future Requirements (deferred)

- Intégration des docs `client_data` (pas de table cible en v1.0)
- Re-import depuis le dashboard (hors onboarding)
- Upload de plus de 4 fichiers en une session
- Relance de Step 4 si le coach a skipé (reminder email / dashboard banner)

---

## Out of Scope

- **Parsing de données client** : pas de table de destination propre pour les docs `client_data` en v1.0. Deferred.
- **Backend changes** : Phase 28 est utilisée telle quelle. Aucune modification backend dans ce milestone.
- **Mobile** : Step 4 web uniquement. L'onboarding mobile athlete (7 steps) n'est pas touché.
- **Nouveau type de doc hors PDF/Excel/Word** : les formats supportés sont ceux de Phase 28 (inchangés).

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| WIZARD-01 | Phase 1 | Pending |
| WIZARD-02 | Phase 1 | Pending |
| WIZARD-03 | Phase 1 | Pending |
| UPLOAD-01 | Phase 2 | Complete |
| UPLOAD-02 | Phase 2 | Complete |
| UPLOAD-03 | Phase 2 | Complete |
| PARSE-01 | Phase 3 | Pending |
| PARSE-02 | Phase 3 | Pending |
| PARSE-03 | Phase 3 | Pending |
| REVIEW-01 | Phase 4 | Pending |
| REVIEW-02 | Phase 4 | Pending |
| REVIEW-03 | Phase 4 | Pending |
| COMPLETE-01 | Phase 4 | Pending |
| COMPLETE-02 | Phase 4 | Pending |
