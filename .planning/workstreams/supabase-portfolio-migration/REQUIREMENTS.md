# Requirements: Migration Supabase ziko → portfolio (v1.19)

**Defined:** 2026-09-21
**Core Value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — with zero data loss, zero regression on `portfolio`'s existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.

## v1 Requirements

### Inventaire & Pre-Flight (INV)

- [x] **INV-01**: Inventaire complet de `ziko` (tables, fonctions, RLS, triggers, buckets, extensions, realtime) via `information_schema` live — pas via comptage des fichiers de migration
- [x] **INV-02**: Inventaire complet de `portfolio` existant (rh_*, gecko_*: tables, fonctions, triggers sur `auth.users`, buckets, extensions)
- [x] **INV-03**: Rapport de collision email/ID entre les 39 users `ziko` et les users existants `portfolio`
- [x] **INV-04**: Vérification parité version Postgres + extensions entre les deux projets
- [x] **INV-05**: Vérification capacité/quota disponible sur `portfolio` (DB size, connexions, storage)

### Schéma, RLS & Fonctions (SCHEMA)

- [x] **SCHEMA-01**: Nouvelle série de migrations (jamais l'historique `ziko` modifié) avec toutes les tables préfixées `ziko_`
- [x] **SCHEMA-02**: Toutes les fonctions/RPC `SECURITY DEFINER` re-créées avec références de table réécrites (`deduct_ai_credits`, `is_coach_of`, `record_athlete_decision`, etc.)
- [x] **SCHEMA-03**: Toutes les policies RLS re-créées et vérifiées activées sur les ~93 tables `ziko_*`
- [x] **SCHEMA-04**: Grep automatisé post-application confirmant zéro référence à un nom de table non-préfixé dans `pg_policies`/`pg_proc`
- [x] **SCHEMA-05**: Dry run complet du rename sur un projet Supabase scratch avant application à `portfolio`

### Fusion Auth (AUTHMIG)

- [x] **AUTHMIG-01**: Les 39 comptes `auth.users` migrés avec UUID préservé (Admin API `createUser`, `password_hash` pass-through)
- [x] **AUTHMIG-02**: `auth.identities` copiées pour les comptes liés à un OAuth provider
- [x] **AUTHMIG-03**: Triggers `handle_new_user` / `handle_new_user_credits` scopés aux signups Ziko uniquement avant fusion des pools
- [x] **AUTHMIG-04**: Config auth (redirect URLs, email templates) fusionnée de manière additive, jamais écrasée
- [x] **AUTHMIG-05**: Utilisateurs Ziko informés qu'une re-connexion sera nécessaire (JWT secret ne peut pas être réutilisé dans un projet partagé)

### Copie des Données (DATA)

- [x] **DATA-01**: Toutes les tables `ziko_*` chargées via COPY avec triggers désactivés pendant le chargement
- [x] **DATA-02**: Séquences réconciliées (`setval`) pour les PK non-UUID
- [x] **DATA-03**: Parité row-count vérifiée table par table (source vs destination)
- [x] **DATA-04**: Contraintes FK re-validées (`VALIDATE CONSTRAINT`) + détection de lignes orphelines
- [x] **DATA-05**: Suite de vérification automatisée réutilisable (row counts, RLS enabled, FK orphans) versionnée dans le repo

### Migration Storage (STORAGE)

- [x] **STORAGE-01**: 9 buckets recréés dans `portfolio` avec préfixe `ziko-`
- [x] **STORAGE-02**: Objets copiés (download/reupload script) avec vérification count/checksum
- [x] **STORAGE-03**: Policies RLS storage (pattern `storage.foldername`) reconstruites à la main sur les buckets renommés
- [x] **STORAGE-04**: Flows signed-URL re-testés avec une vraie session authentifiée (pas service-role) par plugin concerné

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| INV-01 | Phase 1 - Inventory & Pre-Flight Audit | Complete |
| INV-02 | Phase 1 - Inventory & Pre-Flight Audit | Complete |
| INV-03 | Phase 1 - Inventory & Pre-Flight Audit | Complete |
| INV-04 | Phase 1 - Inventory & Pre-Flight Audit | Complete |
| INV-05 | Phase 1 - Inventory & Pre-Flight Audit | Complete |
| SCHEMA-01 | Phase 2 - Schema Rename & Function/RLS Rewrite | Complete |
| SCHEMA-02 | Phase 2 - Schema Rename & Function/RLS Rewrite | Complete |
| SCHEMA-03 | Phase 2 - Schema Rename & Function/RLS Rewrite | Complete |
| SCHEMA-04 | Phase 2 - Schema Rename & Function/RLS Rewrite | Complete |
| SCHEMA-05 | Phase 2 - Schema Rename & Function/RLS Rewrite | Complete |
| AUTHMIG-01 | Phase 3 - Auth Merge | Complete |
| AUTHMIG-02 | Phase 3 - Auth Merge | Complete |
| AUTHMIG-03 | Phase 3 - Auth Merge | Complete |
| AUTHMIG-04 | Phase 3 - Auth Merge | Complete |
| AUTHMIG-05 | Phase 3 - Auth Merge | Complete |
| DATA-01 | Phase 4 - Data Copy & Integrity Verification | Complete |
| DATA-02 | Phase 4 - Data Copy & Integrity Verification | Complete |
| DATA-03 | Phase 4 - Data Copy & Integrity Verification | Complete |
| DATA-04 | Phase 4 - Data Copy & Integrity Verification | Complete |
| DATA-05 | Phase 4 - Data Copy & Integrity Verification | Complete |
| STORAGE-01 | Phase 5 - Storage Migration | Complete |
| STORAGE-02 | Phase 5 - Storage Migration | Complete |
| STORAGE-03 | Phase 5 - Storage Migration | Complete |
| STORAGE-04 | Phase 5 - Storage Migration | Complete |
| CUTOVER-01 | Phase 6 - Cutover | Pending |
| CUTOVER-02 | Phase 6 - Cutover | Pending |
| CUTOVER-03 | Phase 6 - Cutover | Pending |
| CUTOVER-04 | Phase 6 - Cutover | Pending |
| CUTOVER-05 | Phase 6 - Cutover | Pending |
| DECOM-01 | Phase 7 - Monitoring & Decommission | Pending |
| DECOM-02 | Phase 7 - Monitoring & Decommission | Pending |
| DECOM-03 | Phase 7 - Monitoring & Decommission | Pending |
| DECOM-04 | Phase 7 - Monitoring & Decommission | Pending |
| DECOM-05 | Phase 7 - Monitoring & Decommission | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-21*
*Last updated: 2026-09-21 after roadmap creation — 7 phases, 34/34 requirements mapped*
