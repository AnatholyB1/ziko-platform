# Phase 1: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 1-Data Foundation
**Areas discussed:** Qui appelle le RPC, Le RPC de comptage, Normalisation des emails, Colonnes et RGPD

---

## Qui appelle le RPC

### Q1 — Par quel chemin l'inscription atteint-elle le RPC `claim_waitlist_signup` ?

| Option | Description | Selected |
|--------|-------------|----------|
| Server Action Next.js | Client service-role, aucun `GRANT` à `anon`. Réutilise `admin.ts`, `ratelimit.ts` et trois actions existantes. Donne un point d'étranglement serveur. | ✓ |
| Appel direct navigateur (anon) | `GRANT EXECUTE ... TO anon`, page entièrement statique. Premier grant à `anon` du codebase, RPC joignable par script, aucun point de limitation serveur. | |
| Route dans l'API Hono | Passe par `backend/api/` et son `rateLimiter.ts`. Ajoute un saut réseau et une dépendance à un second déploiement. | |

**User's choice:** Server Action Next.js
**Notes:** Motivé par la préservation de la posture « zéro grant à `anon` » observée sur les 73 migrations, et par la réutilisation d'infrastructure déjà en place.

### Q2 — Quel grant le RPC reçoit-il ?

**Non posée.** Le scout a trouvé le précédent établi : `REVOKE EXECUTE ... FROM PUBLIC` suivi de `GRANT ... TO <rôle>`, appliqué à `is_coach_of`, `redeem_invitation_code` et `peek_invitation`. Verrouillé comme convention héritée sans consulter l'utilisateur, la question n'étant pas ouverte.

### Q3 — Que renvoie la Server Action, entre WAIT-05 et DATA-07 ?

| Option | Description | Selected |
|--------|-------------|----------|
| Statut réel y compris sur doublon | Ce que prévoyait l'esquisse de recherche. Idéal pour l'inscrit qui revient, mais devient un oracle d'appartenance après la 200ᵉ place. | |
| Confirmation neutre, statut par email | Ferme complètement l'énumération, DATA-07 vrai par construction. Perd le moment de gratification en page et dépend d'un email délivré. | |
| Statut réel seulement si nouvelle | L'attaquant ne voit jamais le rang d'un tiers, mais l'inégalité de traitement reste observable. | ✓ |

**User's choice:** Statut réel seulement si nouvelle
**Notes:** Le résidu d'énumération était explicité dans la description de l'option ; le choix a été fait en connaissance de cause.

### Q4 — Comment résoudre le conflit entre ce choix et DATA-07 ?

Soulevé par Claude : le choix retenu en Q3 rend DATA-07 infaisable tel qu'il était écrit, et ferait échouer le critère de succès n°5 de la phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Affaiblir DATA-07 au statut fondateur | Assume que l'appartenance est divulgable ; protège la place fondateur. Rate limiting rend le balayage coûteux sans l'interdire. | ✓ |
| Revenir à la confirmation neutre | DATA-07 et le critère n°5 intacts sans réécriture, au prix du moment « tu es le fondateur n°43 ». | |
| Révélation différée sur la même page | Tient DATA-07 et préserve la gratification, mais ajoute un jeton de vérification et un second état de page à la phase 5. | |

**User's choice:** Affaiblir DATA-07 au statut fondateur
**Notes:** A entraîné la réécriture de `REQUIREMENTS.md` DATA-07 et du critère de succès n°5 dans `ROADMAP.md`.

### Q5 — La phase 1 livre-t-elle la Server Action ou seulement le SQL ?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL + Server Action | Le plafond sous concurrence devient testable de bout en bout dans la phase qui le promet. | ✓ |
| SQL uniquement | Découpage plus net par couche, mais le critère n°1 ne serait vérifiable qu'en appelant le RPC hors du chemin de production. | |

**User's choice:** SQL + Server Action

---

## Le RPC de comptage

### Q1 — Que renvoie le RPC de lecture ?

| Option | Description | Selected |
|--------|-------------|----------|
| Places restantes brutes | Un entier ; seuil appliqué côté Next.js. Simple, mais règle métier partagée et nombre exact transitant toujours. | |
| Objet déjà arbitré par le seuil | `{ should_display, remaining, is_full }`, seuil lu depuis une table de réglages. Règle au même endroit que la séquence, nombre protégé avant révélation. | ✓ |
| Compteur + horodatage, arbitrage serveur | Contrôle fin sur la monotonie, mais une variable d'environnement Vercel exige un redéploiement — contredit FOND-06. | |

**User's choice:** Objet déjà arbitré par le seuil

### Q2 — FOND-04 contre LEGAL-09 : que fait l'effacement d'un fondateur ?

Collision soulevée par Claude : supprimer une ligne fondateur ferait remonter `200 - COUNT(is_founder)`.

| Option | Description | Selected |
|--------|-------------|----------|
| Anonymiser au lieu de supprimer | Monotonie par construction ; une ligne anonymisée sort du champ du RGPD ; la place reste consommée. | ✓ |
| Compter depuis la séquence | Suppression réellement possible, mais les rangs brûlés par une transaction annulée fausseraient le nombre affiché. | |
| Supprimer et libérer la place | Le plus simple juridiquement, mais FOND-04 devrait être abandonné. | |

**User's choice:** Anonymiser au lieu de supprimer

### Q3 — Où vit le seuil de révélation (FOND-06) ?

| Option | Description | Selected |
|--------|-------------|----------|
| Table `app_config` partagée | Un seul mécanisme pour le seuil de la phase 1 et le feature flag CRED-05 de la phase 4. | ✓ |
| Colonne dédiée à la waitlist | Périmètre plus resserré, mais laisse la phase 4 inventer un second dispositif. | |

**User's choice:** Table `app_config` partagée
**Notes:** Crée une dépendance phase 4 → phase 1 enregistrée dans `ROADMAP.md`.

### Q4 — Quelle fraîcheur le compteur garantit-il ?

| Option | Description | Selected |
|--------|-------------|----------|
| Aucun cache, lecture à chaque rendu | FOND-03 au sens strict, FOND-04 trivial, mais un aller-retour Supabase par visite. | |
| Cache court avec plancher monotone | Absorbe le trafic et rend FOND-04 vrai même entre nœuds divergents. Upstash déjà en place. | ✓ |
| Cache court sans garantie explicite | Le plus simple, mais FOND-04 ne serait vrai que par chance. | |

**User's choice:** Cache court avec plancher monotone

---

## Normalisation des emails

### Q1 — Jusqu'où va la normalisation avant l'index unique ?

| Option | Description | Selected |
|--------|-------------|----------|
| `lower(trim())` seulement | Aucun risque de fusion abusive, mais farmer les 200 places demande très peu d'effort. | |
| Neutraliser le sous-adressage | `+` retiré partout, points sur Gmail/Googlemail uniquement. Colle au comportement réel des boîtes. Implique deux colonnes. | ✓ |
| Normalisation agressive | Maximise la résistance, mais fusionne à tort des adresses distinctes là où le point est signifiant. | |

**User's choice:** Neutraliser le sous-adressage

### Q2 — Où s'exécute la normalisation ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dans le RPC, en plpgsql | La garantie vit avec la contrainte ; aucun appelant futur ne peut la contourner. | ✓ |
| Dans la Server Action, en TypeScript | Plus lisible et testable, mais la règle devient contournable et l'index unique ne protège plus. | |
| Les deux, base faisant foi | Retour immédiat et garantie structurelle, au prix d'une logique dupliquée sujette à dérive. | |

**User's choice:** Dans le RPC, en plpgsql

### Q3 — La table contraint-elle le format ?

| Option | Description | Selected |
|--------|-------------|----------|
| `CHECK` de forme minimal | Dernier filet contre une ligne aberrante entrée par un chemin détourné. | ✓ |
| Aucune contrainte en base | Évite d'éparpiller la règle et de refuser une adresse valide mais exotique. | |

**User's choice:** `CHECK` de forme minimal

---

## Colonnes et RGPD

### Q1 — Que capture-t-on au-delà de DATA-01 ?

| Option | Description | Selected |
|--------|-------------|----------|
| `locale` seulement | Empreinte personnelle minimale, la plus simple à justifier dans la mention LEGAL-07. | |
| `locale` + attribution UTM | Rend ENTRY-06 exploitable et identifie le canal ayant rempli les 200 places. | ✓ |
| Strictement DATA-01 | Empreinte minimale absolue, mais la langue de l'email devrait être devinée. | |

**User's choice:** `locale` + attribution UTM
**Notes:** Les UTM liés à un email deviennent des données personnelles — la mention d'information de LEGAL-07 devra les couvrir.

### Q2 — Façonne-t-on la table pour la preuve de consentement ?

| Option | Description | Selected |
|--------|-------------|----------|
| Colonnes de preuve dès maintenant | Pas de seconde migration, et les tout premiers fondateurs — impossibles à rattraper — disposent d'une preuve. | ✓ |
| Laisser la phase 3 s'en charger | Périmètre plus pur et colonnes décidées après consultation, au risque d'inscriptions sans preuve. | |

**User's choice:** Colonnes de preuve dès maintenant

### Q3 — Qui construit la mécanique d'anonymisation ?

| Option | Description | Selected |
|--------|-------------|----------|
| RPC en phase 1, durée en phase 3 | Mécanique et monotonie testées dans la phase qui les promet ; paramètre juridique modifiable sans redéploiement. | ✓ |
| Colonne seulement, mécanique en phase 3 | Périmètre resserré, mais schéma portant un champ que rien n'écrit. | |
| Tout en phase 3 | Plus cohérent à lire, mais la monotonie ne serait vérifiable qu'en phase 3. | |

**User's choice:** RPC en phase 1, durée en phase 3

---

## Claude's Discretion

- Nom et numérotation du fichier de migration (le dépôt mélange `NNN_description.sql` et `YYYYMMDD_description.sql`).
- Nommage des colonnes et des index, structure interne du helper de normalisation plpgsql.
- Technique concrète du test de concurrence prouvant le plafond de 200.
- Durée du cache du compteur, sous réserve du plancher monotone.

## Deferred Ideas

- Paramètres de rate limiting sur la Server Action — phase 5, avec le formulaire.
- Rejet des domaines jetables (WAIT-04) — phase 5.
- Valeur de la durée de conservation (LEGAL-08) — phase 3, écrite dans `app_config`.
- Case de consentement et mention RGPD au point de collecte (LEGAL-06, LEGAL-07) — phases 3 et 5.
- Décompte des `tier='premium'` en production (CRED-01) — gate bloquant de la phase 4.
