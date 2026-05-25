# Requirements: v1.10 Custom Coach Exercises

**Workstream:** custom-coach  
**Milestone:** v1.10 Custom Coach Exercises  
**Status:** Active  

---

## Active Requirements

### Bibliothèque d'exercices custom (EXLIB)

- [ ] **EXLIB-01:** Coach peut créer un exercice custom avec nom, description, muscles ciblés et catégorie
- [ ] **EXLIB-02:** Coach peut uploader une vidéo de démo attachée à un exercice custom (Supabase Storage, bucket `coach-exercises`)
- [ ] **EXLIB-03:** Coach peut uploader une photo de démo attachée à un exercice custom (même bucket)
- [ ] **EXLIB-04:** Coach peut éditer et supprimer ses exercices custom
- [ ] **EXLIB-05:** Exercices custom du coach disponibles dans le typeahead de l'éditeur de programme (fusionnés avec la bibliothèque globale, distingués visuellement)
- [ ] **EXLIB-06:** L'athlète voit la vidéo/photo de démo quand il consulte un exercice dans son programme

### Audit vue client (AUDIT)

- [ ] **AUDIT-01:** Vérifier et garantir que le coach voit les programmes créés par l'athlète dans la vue client detail (Phase 26 coverage check — fix si absent)

---

## Future Requirements

*(Non sélectionnés pour ce milestone)*

- Partage d'exercices custom entre coachs (bibliothèque communautaire)
- Tags et filtres avancés sur la bibliothèque custom
- Import/export exercices CSV

---

## Out of Scope

- Dark mode
- Mobile coach exercise creation (web only pour v1.10)
- Vidéo streaming haute qualité / CDN tiers — Supabase Storage signed URL suffisant pour v1.10

---

## Traceability

*(Rempli par le roadmapper)*

| REQ-ID   | Phase | Phase Name |
|----------|-------|------------|
| AUDIT-01 | TBD   | —          |
| EXLIB-01 | TBD   | —          |
| EXLIB-02 | TBD   | —          |
| EXLIB-03 | TBD   | —          |
| EXLIB-04 | TBD   | —          |
| EXLIB-05 | TBD   | —          |
| EXLIB-06 | TBD   | —          |

---

*Last updated: 2026-05-25 — Milestone v1.10 started*
