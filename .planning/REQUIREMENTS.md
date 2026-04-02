# Requirements: Ziko Platform v1.3 — Security + Cloud Infrastructure

**Defined:** 2026-04-02
**Core Value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and now shows them exactly what's in their food.

## v1.3 Requirements

### Rate Limiting

- [x] **RATE-01**: API retourne 429 + Retry-After quand un IP dépasse le seuil global avant authentification (protection unauthenticated flood via Upstash Redis)
- [x] **RATE-02**: API retourne 429 + Retry-After sur POST /ai/chat et /ai/chat/stream quand un utilisateur authentifié dépasse son quota de requêtes par userId
- [x] **RATE-03**: API retourne 429 + Retry-After sur POST /ai/tools/execute quand un utilisateur dépasse son quota par userId
- [x] **RATE-04**: API retourne 429 + Retry-After sur l'endpoint barcode/scan quand un utilisateur dépasse son quota par userId
- [x] **RATE-05**: API retourne 429 + Retry-After sur les endpoints auth par IP (brute-force protection)

### Supabase Storage

- [ ] **STORE-01**: User peut uploader et mettre à jour sa photo de profil depuis l'app mobile — photo stockée dans bucket `profile-photos`, public URL persistée dans `user_profiles`
- [ ] **STORE-02**: App peut uploader des photos de scan dans bucket `scan-photos` via signed URL (upload direct vers Supabase Storage, contourne la limite 4.5 MB Vercel)
- [ ] **STORE-03**: Bucket `exports` créé et accessible via signed URL pour futurs exports PDF / données (infrastructure uniquement en v1.3)
- [ ] **STORE-04**: Hono expose GET /storage/upload-url?bucket=&path= — retourne une signed URL d'upload valable 60 secondes pour upload direct depuis mobile

### API Security

- [ ] **SEC-01**: CORS restreint aux origines explicites — supprime le wildcard `*.vercel.app` (faille de sécurité active)
- [ ] **SEC-02**: `secureHeaders()` Hono appliqué globalement — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.
- [ ] **SEC-03**: Input validation via `zValidator` enforced sur /ai/chat, /ai/chat/stream, et /ai/tools/execute — schémas Zod avant que les inputs atteignent Claude Sonnet

### Infrastructure

- [x] **INFRA-01**: Upstash Redis provisionné et connecté à l'environnement Vercel (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN dans les env vars)
- [ ] **INFRA-02**: Vercel cron POST /storage/cron/cleanup actif — supprime les objets `scan-photos` > 90 jours et `exports` > 7 jours via Supabase Storage JS client

## Future Requirements (v1.4+)

### Token Economy

- **TOKEN-01**: User gagne des tokens pour chaque action active (login, repas loggé, séance complétée, scan)
- **TOKEN-02**: User peut dépenser des tokens pour accéder aux features IA au-delà du quota gratuit
- **TOKEN-03**: Quota mensuel gratuit (200 chats IA, 2 plans) remis à zéro le 1er du mois
- **TOKEN-04**: Règle "actif du jour" — 2/3 actions débloquent 3 scans gratuits
- **TOKEN-05**: Streaks de connexion (7j +30 tokens, 30j +75 tokens)

### Premium Subscription

- **PREM-01**: User peut souscrire à l'abonnement premium via RevenueCat (iOS/Android) ou Stripe (web)
- **PREM-02**: User premium a accès illimité aux features IA et gagne 2x plus de tokens
- **PREM-03**: User peut obtenir 1 mois premium gratuit en échangeant 2 000 tokens

### Notifications

- **NOTIF-01**: User reçoit une notification de rappel de streak quotidien
- **NOTIF-02**: User est notifié quand un bonus de tokens est débloqué (streak, objectif hebdomadaire)

### Referral

- **REF-01**: User peut générer un code de parrainage unique
- **REF-02**: User gagne 100 tokens quand un ami s'inscrit avec son code

## Out of Scope

| Feature | Reason |
|---------|--------|
| AWS S3 direct | Supabase Storage (backed by S3) suffit — pas de surcoût infrastructure |
| In-memory rate limiting | Inefficace sur Vercel serverless — chaque cold start reset les compteurs |
| Upload proxied via Hono | Hard limit 4.5 MB sur Vercel — signed URL pattern obligatoire |
| Dark mode | Hors scope — light sport theme uniquement |
| Token system / billing | Reporté en v1.4 |
| Push notifications | Reporté en v1.4 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 12 | Complete |
| RATE-01 | Phase 12 | Complete |
| RATE-02 | Phase 12 | Complete |
| RATE-03 | Phase 12 | Complete |
| RATE-04 | Phase 12 | Complete |
| RATE-05 | Phase 12 | Complete |
| SEC-01 | Phase 13 | Pending |
| SEC-02 | Phase 13 | Pending |
| SEC-03 | Phase 13 | Pending |
| STORE-01 | Phase 14 | Pending |
| STORE-02 | Phase 14 | Pending |
| STORE-03 | Phase 14 | Pending |
| STORE-04 | Phase 14 | Pending |
| INFRA-02 | Phase 15 | Pending |

**Coverage:**
- v1.3 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 — milestone v1.3 initial definition*
