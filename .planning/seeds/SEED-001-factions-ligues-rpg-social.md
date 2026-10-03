---
id: SEED-001
status: dormant
planted: 2026-08-30
planted_during: v1.18 AI Coach Core (milestone-mobile) — pre-roadmap discussion
trigger_when: when scoping the RPG/progression/social layer milestone for milestone-mobile after v1.18 AI Coach Core ships (keywords: gamification, RPG, factions, ligues, leaderboards, saisons, loot, progression, mascotte)
scope: large
---

# SEED-001: Factions & Ligues — couche sociale/RPG post-v1.18

## Why This Matters

Dérivé de la discussion de cadrage du milestone v1.18 (2026-08-30). Le spec Notion
"📐 Spec Produit — Système d'engagement & gamification Ziko"
(https://app.notion.com/p/3c90a4717ba381338eacc49335823dca) posait déjà la couche
RPG (progression, loot, saisons, leaderboards) en P1-P3. Cette discussion l'a
affinée avec des mécaniques concrètes et des garde-fous qui n'étaient pas encore
dans le spec Notion — à ne pas reperdre quand on scope la suite.

Le principe directeur : la couche sociale doit suivre la même philosophie SDT que
la progression individuelle (autonomie/compétence/relation) — jamais un mur social
ou une comparaison qui écrase un profil fragile dès le début.

## When to Surface

**Trigger:** quand on lance `/gsd:new-milestone` pour milestone-mobile après que
v1.18 (AI Coach Core) soit shippé, ou dès que le scope mentionne gamification /
RPG / factions / ligues / leaderboards / saisons / loot / mascotte étendue.

Ce milestone suivant reprend les chantiers P1-P3 du spec Notion (streaks,
progression/niveaux/loot, leaderboards, saison/battle pass, mascotte étendue) —
ce seed capture les décisions de design supplémentaires prises pendant le
cadrage de v1.18.

## Scope Estimate

**Large** — probablement son propre milestone (v1.19), possiblement scindé en
plusieurs selon la priorisation P1/P2/P3 déjà proposée dans le spec Notion.

## Mécaniques décidées pendant la discussion v1.18

- **Factions = sport/objectif**, pas hiérarchie. Réutilise directement la
  taxonomy sport déjà en place côté dashboards coach (v1.8 Sport Dashboards :
  Powerlifting / Hyrox / Running / Bodybuilding / Perte de poids) — pas de
  nouveau système de catégorisation à inventer.
- **Ligues = piste d'engagement**, orthogonale à la faction : "Piste Habitudes"
  vs "Piste Performance". Une personne qui log juste ses habitudes ne doit
  **jamais** être comparée à un sportif régulier — deux lignes de classement
  étanches, pas un score normalisé entre les deux.
- La piste d'un athlète se lit directement depuis le profil capturé à
  l'onboarding (niveau de départ) et se met à jour via le système de review
  hebdo construit en v1.18 — pas un calcul séparé.
- **Transition Habitudes → Performance décidée uniquement par l'IA**, sans
  confirmation utilisateur (décision explicite de l'utilisateur le 2026-08-30),
  avec une célébration au moment du passage.
- **Garde-fous ligues avec montée/descente** (pour éviter l'effet Duolingo
  compulsif / punitif, contradictoire avec le principe "le streak ne pénalise
  pas" déjà acté en v1.18) :
  - Score basé sur la régularité / l'effort relatif à ce qui était demandé,
    jamais sur la performance brute.
  - Ligues débloquées à un palier de confiance/niveau, jamais offertes dès J0.
  - Pas de vraie chute en dessous du palier de départ (amorti, façon streak
    freeze) — pour ne pas punir un profil déjà fragile.
- **Défis collectifs ("raids")** préférés à la comparaison individuelle nominative
  pour les profils peu confiants — ex. "le groupe cumule X litres d'eau cette
  semaine" plutôt qu'un classement nominatif exposant la performance individuelle.
- **Le lien coach↔athlète existant (`coach_client_links`) est le point d'entrée
  social le moins cher** — un défi de groupe coach+ses athlètes est presque
  gratuit à construire par-dessus l'existant, avant d'ouvrir un vrai réseau
  social entre users inconnus entre eux.
- Le mécanisme de récompense par points/palier/pool (choisi par l'IA dans un pool
  de récompenses possibles, pas de tirage aléatoire — contrainte ANJ) est déjà
  scopé pour v1.18 ; la couche cosmétique/loot visuelle (coffres, skins) reste
  ici en v1.19+.

## Breadcrumbs

- Spec Notion source : "📐 Spec Produit — Système d'engagement & gamification
  Ziko" — https://app.notion.com/p/3c90a4717ba381338eacc49335823dca
- v1.18 AI Coach Core (milestone-mobile) — architecture soeur : `athlete_state`
  + `athlete_decisions` (journal de décisions IA par athlète, inspiré du pattern
  GSD Key Decisions / STATE.md) — la couche ligues/factions doit lire ce même
  état plutôt que dupliquer une logique de niveau séparée.
- Sport taxonomy existante : v1.8 Sport Dashboards
  (`.planning/milestones/v1.8-*`) — Powerlifting/Hyrox/Running/Bodybuilding/
  Weight Loss.

## Notes

Décisions ouvertes du spec Notion original toujours pertinentes pour ce futur
milestone : monnaie du loot (crédits IA existants vs monnaie dédiée — v1.18
tranche pour des crédits IA + pool de récompenses, donc probablement déjà
répondu), saison cosmétique pur vs déblocages fonctionnels, guildes ouvertes
vs centrées coach↔athlètes au départ, outil d'instrumentation analytics.
