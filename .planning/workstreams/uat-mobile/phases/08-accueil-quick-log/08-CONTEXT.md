# Phase 8: Accueil & Quick Log - Context

**Gathered:** 2026-11-12 (recap chantier 4). Req : QLOG-01..05. Vague 1. UI hint oui -> contrat design (agent wave-1 contracts) avant build.

## Decisions verrouillees
- **D-01** QLOG-01 eau : la tuile affiche le **total du jour** (aujourd'hui "0.00L" apres +250 ml) ; logs illimites par jour (somme des logs du jour en fuseau local).
- **D-02** QLOG-02/03 poids et humeur : **1 par jour** ; le statut "logue" **persiste** jusqu'au lendemain, y compris apres relance de l'app (source de verite = base, pas l'etat local ; cache MMKV seulement en lecture optimiste). Re-logger le meme jour = modifier la valeur du jour (pas de doublon). Changement de jour = fuseau local de l'utilisateur.
- **D-03** QLOG-04 : la tuile repas ouvre l'ajout de repas (P9 refera l'ecran ; ici elle ouvre l'ecran existant) et affiche les **kcal du jour**.
- **D-04** QLOG-05 : la carte score (haut de l'accueil, score 0 / jauge vide) calcule des valeurs correctes d'apres les donnees reelles ; si pas de donnees, **etat vide explique** (texte + action), pas "0" trompeur. Definir la formule dans le plan (documenter) a partir de l'existant.
- **D-05** Migration probable (bloc `20261201 0801-0809`) pour un statut quotidien poids/humeur ; **d'abord verifier** si les tables de logs existantes (ex. `ziko_body_measurements`, journal humeur) permettent la contrainte "1/jour" par index unique partiel ou requete ; ne creer une migration que si necessaire. Fichier SQL seulement ; jamais applique par l'agent.
- **D-06** Fichiers : `apps/mobile/app/(app)/index.tsx` + composants d'accueil (P8 proprietaire de la structure des tuiles) ; P5/P6 font des edits localises, merge P5 -> P6 -> P8. Charte inline styles.
- **D-07** Libelles FR ; pas d'emoji ; Ionicons.

## Zones grises restantes
Aucune produit. (Formule exacte du score = decision technique documentee par le builder.)
