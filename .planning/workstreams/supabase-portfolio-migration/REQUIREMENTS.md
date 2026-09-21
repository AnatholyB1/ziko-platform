# Requirements: Migration Supabase ziko → portfolio (v1.19)

**Defined:** 2026-09-21
**Core Value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — with zero data loss, zero regression on `portfolio`'s existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.

## v1 Requirements

### Inventaire & Pre-Flight (INV)

- [ ] **INV-01**: Inventaire complet de `ziko` (tables, fonctions, RLS, triggers, buckets, extensions, realtime) via `information_schema` live — pas via comptage des fichiers de migration
- [ ] **INV-02**: Inventaire complet de `portfolio` existant (rh_*, gecko_*: tables, fonctions, triggers sur `auth.users`, buckets, extensions)
- [ ] **INV-03**: Rapport de collision email/ID entre les 39 users `ziko` et les users existants `portfolio`
- [ ] **INV-04**: Vérification parité version Postgres + extensions entre les deux projets
- [ ] **INV-05**: Vérification capacité/quota disponible sur `portfolio` (DB size, connexions, storage)

### Schéma, RLS & Fonctions (SCHEMA)

- [ ] **SCHEMA-01**: Nouvelle série de migrations (jamais l'historique `ziko` modifié) avec toutes les tables préfixées `ziko_`
- [ ] **SCHEMA-02**: Toutes les fonctions/RPC `SECURITY DEFINER` re-créées avec références de table réécrites (`deduct_ai_credits`, `is_coach_of`, `record_athlete_decision`, etc.)
- [ ] **SCHEMA-03**: Toutes les policies RLS re-créées et vérifiées activées sur les ~93 tables `ziko_*`
- [ ] **SCHEMA-04**: Grep automatisé post-application confirmant zéro référence à un nom de table non-préfixé dans `pg_policies`/`pg_proc`
- [ ] **SCHEMA-05**: Dry run complet du rename sur un projet Supabase scratch avant application à `portfolio`

### Fusion Auth (AUTHMIG)

- [ ] **AUTHMIG-01**: Les 39 comptes `auth.users` migrés avec UUID préservé (Admin API `createUser`, `password_hash` pass-through)
- [ ] **AUTHMIG-02**: `auth.identities` copiées pour les comptes liés à un OAuth provider
- [ ] **AUTHMIG-03**: Triggers `handle_new_user` / `handle_new_user_credits` scopés aux signups Ziko uniquement avant fusion des pools
- [ ] **AUTHMIG-04**: Config auth (redirect URLs, email templates) fusionnée de manière additive, jamais écrasée
- [ ] **AUTHMIG-05**: Utilisateurs Ziko informés qu'une re-connexion sera nécessaire (JWT secret ne peut pas être réutilisé dans un projet partagé)

### Copie des Données (DATA)

- [ ] **DATA-01**: Toutes les tables `ziko_*` chargées via COPY avec triggers désactivés pendant le chargement
- [ ] **DATA-02**: Séquences réconciliées (`setval`) pour les PK non-UUID
- [ ] **DATA-03**: Parité row-count vérifiée table par table (source vs destination)
- [ ] **DATA-04**: Contraintes FK re-validées (`VALIDATE CONSTRAINT`) + détection de lignes orphelines
- [ ] **DATA-05**: Suite de vérification automatisée réutilisable (row counts, RLS enabled, FK orphans) versionnée dans le repo

### Migration Storage (STORAGE)

- [ ] **STORAGE-01**: 9 buckets recréés dans `portfolio` avec préfixe `ziko-`
- [ ] **STORAGE-02**: Objets copiés (download/reupload script) avec vérification count/checksum
- [ ] **STORAGE-03**: Policies RLS storage (pattern `storage.foldername`) reconstruites à la main sur les buckets renommés
- [ ] **STORAGE-04**: Flows signed-URL re-testés avec une vraie session authentifiée (pas service-role) par plugin concerné

### Cutover (CUTOVER)

- [ ] **CUTOVER-01**: Fichiers env locaux mis à jour (`apps/mobile/.env`, `apps/web/.env.local`, `backend/api/.env.local`)
- [ ] **CUTOVER-02**: Variables Vercel mises à jour sur les projets web et backend API
- [ ] **CUTOVER-03**: Bascule ordonnée backend → web → mobile, jamais simultanée, chaque surface smoke-testée avant la suivante
- [ ] **CUTOVER-04**: Régression vérifiée nulle sur `rh_*` et `gecko_*` après fusion
- [ ] **CUTOVER-05**: CI (`migrate-supabase` job) et secrets GitHub repointés vers `portfolio`

### Monitoring & Décommission (DECOM)

- [ ] **DECOM-01**: `ziko` gardé vivant en lecture seule pendant une fenêtre de rollback définie (alignée sur le renouvellement naturel des binaires mobile côté stores, pas d'OTA forcée)
- [ ] **DECOM-02**: Backup froid (pg_dump + export storage) de `ziko` pris et confirmé restaurable avant suppression
- [ ] **DECOM-03**: Checklist complète par table/bucket (pas d'échantillonnage) validée
- [ ] **DECOM-04**: Confirmation explicite et séparée de l'utilisateur avant suppression irréversible du projet `ziko`
- [ ] **DECOM-05**: Projet `ziko` supprimé uniquement après validation de tous les items ci-dessus

## v2 Requirements

Aucune — cette milestone est un projet fermé (migration one-shot), pas une base pour itération future.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Refonte fonctionnelle du schéma au-delà du renommage/préfixage | Hors périmètre — cette milestone est un rename-and-relocate, pas une réarchitecture |
| Migration vers un fournisseur autre que Supabase | Hors périmètre — cible fixée sur le projet Supabase `portfolio` existant |
| Zero-downtime dual-write / réplication logique Postgres | Réplication logique ne supporte pas le remapping de noms de table en cours de flux ; non justifié à l'échelle de 39 utilisateurs (write-freeze court + delta-sync suffit) |
| EAS Update OTA pour forcer la bascule mobile | Décision utilisateur : attendre le renouvellement naturel des binaires via mise à jour store plutôt que forcer une bascule OTA |

## Traceability

Filled by the roadmapper during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INV-01..05 | TBD | Pending |
| SCHEMA-01..05 | TBD | Pending |
| AUTHMIG-01..05 | TBD | Pending |
| DATA-01..05 | TBD | Pending |
| STORAGE-01..04 | TBD | Pending |
| CUTOVER-01..05 | TBD | Pending |
| DECOM-01..05 | TBD | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 34 ⚠️

---
*Requirements defined: 2026-09-21*
*Last updated: 2026-09-21 after initial definition*
