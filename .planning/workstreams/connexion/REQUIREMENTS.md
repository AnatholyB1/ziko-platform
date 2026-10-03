# Requirements: Connexion Google & Apple (Mobile)

**Defined:** 2026-08-23
**Core Value:** L'utilisateur peut créer un compte et se connecter à l'app mobile Ziko via Google ou Apple, sans friction et sans doublon de compte.

## v1 Requirements

### Authentification sociale

- [ ] **OAUTH-01**: L'utilisateur peut se connecter avec Google depuis l'écran welcome (flow natif — remplace l'actuel `signInWithOAuth` web-redirect qui ne revient jamais dans l'app)
- [ ] **OAUTH-02**: L'utilisateur peut se connecter avec Apple depuis l'écran welcome (Sign in with Apple — requis par l'App Store Review Guideline 4.8 puisqu'un login social tiers, Google, est proposé)
- [ ] **OAUTH-03**: Une première connexion Google/Apple crée un compte Supabase et route l'utilisateur vers l'onboarding (`/(auth)/onboarding/step-1`), comme l'inscription email/password
- [ ] **OAUTH-04**: Une connexion Google/Apple sur un compte déjà onboardé route directement dans l'app (`/(app)/`), sans repasser par l'onboarding
- [ ] **OAUTH-05**: L'annulation du picker natif (Google ou Apple) ne déclenche aucune erreur — retour silencieux à l'écran welcome
- [ ] **OAUTH-06**: Un échec provider/réseau pendant la connexion affiche un message d'erreur en français via `showAlert`
- [ ] **OAUTH-07**: La session issue d'une connexion Google/Apple persiste au redémarrage de l'app, au même titre qu'une session email/password
- [ ] **OAUTH-11**: Si l'email Google/Apple correspond à un compte email/password existant dont l'email est déjà vérifié, la connexion lie automatiquement la nouvelle identité OAuth à ce compte (pas de doublon, pas d'écran d'erreur) — nécessite l'activation du linking automatique côté Supabase Auth et repose sur le fait que Google/Apple garantissent des emails déjà vérifiés

### Configuration native

- [x] **OAUTH-08**: Le build iOS embarque l'entitlement `com.apple.developer.applesignin`
- [ ] **OAUTH-09**: Un client OAuth Android est configuré (SHA-1 keystore dev + prod enregistrées) et relié à `google-services.json`
- [ ] **OAUTH-10**: Les providers Google et Apple sont activés dans le dashboard Supabase Auth du projet `ziko`, avec les client IDs/secrets corrects, et le linking automatique par email vérifié est activé (support d'OAUTH-11)

## v2 Requirements

Reporté à une future version.

### Connexion sociale étendue

- **OAUTH-12**: Login Google/Apple côté web (coach platform)
- **OAUTH-13**: L'utilisateur déjà connecté (email/password) peut lier manuellement un compte Google/Apple depuis les réglages

## Out of Scope

Explicitement exclu de ce milestone.

| Feature | Reason |
|---------|--------|
| Login Facebook ou autres providers sociaux | Non demandé, pas de valeur produit identifiée |
| Login Google/Apple sur le web coach platform | Mobile only pour ce milestone — voir OAUTH-12 (v2) |
| Linking manuel depuis les réglages (compte déjà connecté) | Le linking automatique (OAUTH-11) couvre le cas principal — voir OAUTH-13 (v2) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OAUTH-08 | Phase 1 | Complete |
| OAUTH-09 | Phase 1 | Pending |
| OAUTH-10 | Phase 1 | Pending |
| OAUTH-01 | Phase 2 | Pending |
| OAUTH-02 | Phase 2 | Pending |
| OAUTH-03 | Phase 2 | Pending |
| OAUTH-04 | Phase 2 | Pending |
| OAUTH-05 | Phase 2 | Pending |
| OAUTH-06 | Phase 2 | Pending |
| OAUTH-07 | Phase 2 | Pending |
| OAUTH-11 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-23*
*Last updated: 2026-08-23 after initial definition*
