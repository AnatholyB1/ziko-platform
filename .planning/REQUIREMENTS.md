# Requirements: Ziko Platform — v1.18 AI Coach Core

**Defined:** 2026-08-30
**Core Value:** L'IA devient le pilote central de l'expérience athlète — onboarding conversationnel qui profile la personne, moteur qui décide des objectifs/étapes hebdomadaires adaptés à son niveau réel, récompenses et déblocage de fonctionnalités qui suivent sa progression réelle plutôt qu'un calendrier fixe.

## v1 Requirements

Requirements for v1.18. Each maps to roadmap phases.

### Fondation — État & Journal de Décisions (FOUND)

- [ ] **FOUND-01**: Le système maintient un état courant compact par athlète (`athlete_state`: niveau, palier, focus actuel, readiness) — toujours à jour, jamais un blob qui grossit
- [ ] **FOUND-02**: Le système maintient un journal de décisions append-only par athlète (`athlete_decisions`) — chaque décision IA (focus assigné, récompense accordée, changement de niveau) tracée avec sa justification et les données réelles sur lesquelles elle s'est basée
- [ ] **FOUND-03**: Toute écriture sur `athlete_state` passe par un chemin serveur unique qui revalide contre les données d'activité réelles — jamais une décision de l'IA appliquée sans vérification
- [ ] **FOUND-04**: Un athlète ne peut lire que son propre état/journal (RLS) ; aucune écriture cliente directe possible
- [ ] **FOUND-05**: Le journal de décisions reste borné dans le contexte de l'IA (résumé compact + fenêtre récente, jamais un rejeu complet) même après des mois d'ancienneté

### Onboarding Conversationnel (ONBOARD)

- [ ] **ONBOARD-01**: Un nouvel athlète a un onboarding conversationnel en texte libre (≤4 questions) avec la mascotte, en complément de l'onboarding structuré 7 étapes existant (pas un remplacement)
- [ ] **ONBOARD-02**: L'IA infère un profil expérience/confiance/risque d'adhérence depuis les réponses en texte libre (pas seulement des champs structurés), avec un score de confiance auto-déclaré par attribut inféré
- [ ] **ONBOARD-03**: L'athlète reçoit une micro-action immédiatement réalisable, adaptée à son profil inféré, dans les 5 minutes suivant le début de l'onboarding
- [ ] **ONBOARD-04**: Compléter cette première micro-action déclenche une célébration (mascotte + animation)
- [ ] **ONBOARD-05**: L'onboarding écrit le niveau/palier/focus de départ de l'athlète dans `athlete_state`
- [ ] **ONBOARD-06**: Les athlètes déjà passés par l'onboarding structuré existant (avant v1.18) reçoivent un niveau de départ recalculé rétrospectivement par l'IA depuis leur historique d'activité réel — pas un niveau par défaut

### Moteur de Décision Adaptatif Hebdo (ENGINE)

- [ ] **ENGINE-01**: Chaque semaine, le système compare l'activité réellement loggée de chaque athlète actif (pas de l'auto-déclaratif) à son focus assigné pour cette semaine
- [ ] **ENGINE-02**: L'IA décide du focus de la semaine suivante à partir de cette comparaison et de l'historique de décisions de l'athlète
- [ ] **ENGINE-03**: Le moteur hebdo agit comme garde-fou qui corrige les erreurs de profilage de l'onboarding (peut escalader ou désescalader indépendamment du profil de départ)
- [ ] **ENGINE-04**: L'exécution de la revue hebdo est idempotente par athlète par semaine (résiste à la livraison "at-least-once" des crons Vercel)
- [ ] **ENGINE-05**: Le coût IA du moteur hebdo est comptabilisé indépendamment (`ai_cost_log`) et financé en opex plateforme — jamais déduit du solde de crédits IA de l'athlète
- [ ] **ENGINE-06**: De nouveaux tools IA (`create_goal`, `create_program`) sont exposés au registre existant de l'orchestrateur, utilisables à la fois par le moteur hebdo et le chat interactif

### Récompenses Non-Punitives par Palier (REWARD)

- [ ] **REWARD-01**: Les athlètes accumulent des points selon le résultat de la revue hebdo — objectif atteint = récompense standard, dépassé = meilleure récompense, en-dessous = aucune récompense mais jamais de pénalité
- [ ] **REWARD-02**: Les points débloquent des paliers ; chaque palier a un pool de récompenses éligibles
- [ ] **REWARD-03**: L'IA sélectionne exactement une récompense dans le pool éligible par déblocage — sélection déterministe uniquement, jamais aléatoire (contrainte réglementaire ANJ)
- [ ] **REWARD-04**: Les paliers et récompenses débloqués sont monotones — une fois débloqués, jamais révoqués ni diminués
- [ ] **REWARD-05**: Le système points/paliers/récompenses est un modèle de données neuf et dédié — distinct du mécanisme d'achat à prix fixe du plugin gamification existant (coins/shop)

### Déblocage Progressif de Fonctionnalités (GATE)

- [ ] **GATE-01**: Chaque manifest de plugin peut déclarer un niveau minimum requis pour être visible (`minLevel`)
- [ ] **GATE-02**: `PluginLoader` masque les plugins au-dessus du niveau courant de l'athlète, en plus de ses vérifications existantes (`mandatory`/`is_enabled`)
- [ ] **GATE-03**: Un athlète sans ligne `athlete_state` (pas encore passé par le nouveau flow) reste au niveau minimum garanti, jamais bloqué à zéro accès
- [ ] **GATE-04**: Le tiroir de plugins indique visuellement les plugins verrouillés et ce qu'il faut pour les débloquer

### Câblage Contexte, Notifications & Coûts (OPS)

- [ ] **OPS-01**: `athlete_state` est injecté dans le prompt système de l'orchestrateur IA comme 7ème requête parallèle, aux côtés des 6 existantes
- [ ] **OPS-02**: L'athlète reçoit une notification push quand sa revue hebdomadaire se termine avec un nouveau focus/une nouvelle récompense
- [ ] **OPS-03**: Tous les nouveaux appels IA autonomes (`assess_profile`, `create_goal`, `create_reward`, `create_program` en mode système) sont loggés dans `ai_cost_log` pour la visibilité des coûts, indépendamment du credit-gating

## v2 Requirements

Deferred to a later iteration of this same milestone track. Tracked but not in the current roadmap.

### Onboarding

- **ONBOARD-V2-01**: Scoring de confiance basé sur les logprobs pour l'extraction d'onboarding (remplace le champ auto-déclaré) — déclenché si une revue manuelle montre une sur/sous-confiance systématique

### Récompenses

- **REWARD-V2-01**: Pools de récompenses personnalisables/curés par le coach par palier (au lieu d'un pool fixe seedé par l'équipe)

### Moteur de Décision

- **ENGINE-V2-01**: Signal de readiness enrichi par les données RPE existantes (pas seulement le volume d'activité loggée) alimentant le moteur hebdo

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Factions par sport/objectif, ligues Habitudes/Performance, promotion/relégation, leaderboards, saisons/battle pass | Couche RPG/sociale complète, cadrée en discussion mais explicitement repoussée à un futur milestone — voir `SEED-001` |
| Loot/cosmétiques (skins, coffres visuels) | Hors scope v1.18 — aucune mécanique de personnalisation visuelle des récompenses |
| Mascotte multi-états animée persistante (transverse à toute l'app) | v1.18 = mascotte chat-only pour l'onboarding ; le système de personnage étendu appartient à la couche RPG future |
| Récompenses à tirage aléatoire (loot box) | Contrainte réglementaire ANJ — le mécanisme est explicitement déterministe (choix IA dans un pool, jamais de hasard) |
| Réutilisation du plugin `gamification` existant (XP/coins/shop) pour le nouveau mécanisme de récompense | Modèle d'achat à prix fixe incompatible avec la sélection IA dans un pool — voir `.planning/research/FEATURES.md` Anti-Features |
| Remplacement de l'onboarding structuré 7 étapes existant | Le flow conversationnel s'ajoute pour le profilage comportemental/subjectif ; ne remplace pas la capture des faits objectifs (objectifs, équipement, contraintes) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 42 | Mapped |
| FOUND-02 | Phase 42 | Mapped |
| FOUND-03 | Phase 42 | Mapped |
| FOUND-04 | Phase 42 | Mapped |
| FOUND-05 | Phase 42 | Mapped |
| ONBOARD-01 | Phase 43 | Mapped |
| ONBOARD-02 | Phase 43 | Mapped |
| ONBOARD-03 | Phase 43 | Mapped |
| ONBOARD-04 | Phase 43 | Mapped |
| ONBOARD-05 | Phase 43 | Mapped |
| ONBOARD-06 | Phase 43 | Mapped |
| ENGINE-01 | Phase 44 | Mapped |
| ENGINE-02 | Phase 44 | Mapped |
| ENGINE-03 | Phase 44 | Mapped |
| ENGINE-04 | Phase 44 | Mapped |
| ENGINE-05 | Phase 44 | Mapped |
| ENGINE-06 | Phase 44 | Mapped |
| REWARD-01 | Phase 45 | Mapped |
| REWARD-02 | Phase 45 | Mapped |
| REWARD-03 | Phase 45 | Mapped |
| REWARD-04 | Phase 45 | Mapped |
| REWARD-05 | Phase 45 | Mapped |
| GATE-01 | Phase 46 | Mapped |
| GATE-02 | Phase 46 | Mapped |
| GATE-03 | Phase 46 | Mapped |
| GATE-04 | Phase 46 | Mapped |
| OPS-01 | Phase 47 | Mapped |
| OPS-02 | Phase 47 | Mapped |
| OPS-03 | Phase 47 | Mapped |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓ (roadmap created 2026-08-30 — see .planning/workstreams/milestone-mobile/ROADMAP.md, phases 42–47)

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 after roadmap creation (29/29 requirements mapped to phases 42–47)*
