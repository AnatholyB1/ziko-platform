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

| REQ-ID   | Phase | Phase Name                                       | Status  |
|----------|-------|--------------------------------------------------|---------|
| AUDIT-01 | 42    | Audit Client Programs Visibility                 | Pending |
| EXLIB-01 | 43    | Coach Exercise Library Backend + Web UI          | Pending |
| EXLIB-02 | 43    | Coach Exercise Library Backend + Web UI          | Pending |
| EXLIB-03 | 43    | Coach Exercise Library Backend + Web UI          | Pending |
| EXLIB-04 | 43    | Coach Exercise Library Backend + Web UI          | Pending |
| EXLIB-05 | 44    | Program Editor + Athlete Media Integration       | Pending |
| EXLIB-06 | 44    | Program Editor + Athlete Media Integration       | Pending |

---

*Last updated: 2026-05-25 — Roadmap created, all 7 requirements mapped to phases 42–44*
