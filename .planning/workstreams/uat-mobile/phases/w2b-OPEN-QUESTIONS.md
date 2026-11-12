# Questions ouvertes w2b (phases 18, 19, 20, 21, 22) : 12 au maximum

Uniquement les points qui changent l'implémentation. Recommandation en premier (marquée **[RECO]**). Les décisions produit du recap et celles tranchées par les maquettes (lots C/D) ne sont pas redemandées. Détail et preuves dans `NN-CONTEXT.md` de chaque phase.

## Transverses

**Q-X1 : orange d'action des lots C/D (P18, P19, P20, P21)** (`lot-C/CRITIQUE.md` Q1 ; probablement déjà posée par la voie A/B)
1. **[RECO]** Nouveau token `actionPrimary = #CF4509` pour les boutons pleins, interrupteurs et indicateurs actifs à texte blanc (4,66:1) ; `#FF5C1A` reste la couleur de marque pour le reste. Les maquettes C/D sont déjà rendues ainsi.
2. Garder `#FF5C1A` partout avec libellé `#1C1A17` sur les boutons pleins (5,62:1) : les maquettes C/D ne sont alors plus exactes.
3. Accepter l'exception 3,09:1 de la charte (échec AA).

**Q-X2 : second compte athlète de test (P21 ; harnais P1)** : AM-3/5/6 exigent deux comptes (A envoie, B reçoit). HARN-03 ne prévoit qu'un athlète + un coach.
1. **[RECO]** Ajouter un athlète B au jeu de données du harnais (email + mot de passe hors repo, réinitialisable), créé par le script de seed de P1.
2. Utiliser le compte coach lié comme "B" (non fiable : le coach n'a pas le même parcours Amis).

## P18 Stretching

**Q-P18 : la carte "routine par défaut" en tête de séance fait-elle quelque chose ?** (contrat : `Passer` / `Modifier` seulement)
1. **[RECO]** Toucher la carte lance la routine (`StretchingSession`), puis revient à la séance ; terminer écrit un log de stretching (ne compte jamais comme série validée). `Passer` la retire pour cette séance.
2. Carte purement informative (rappel) ; l'utilisateur lance la routine lui-même depuis Stretching.

## P19 Compléments

**Q-P19 : que deviennent les favoris existants (`ziko_user_supplement_favorites`) ?**
1. **[RECO]** Le coeur de la fiche produit devient `Ajouter à mon stack` ; la table n'est plus utilisée, aucune conversion automatique (dose et moment inconnus) ; "Mon stack" démarre vide pour tous.
2. Convertir les favoris en lignes de stack avec dose par défaut et un moment `Matin` (stack non vide dès le premier lancement, mais données inventées, contredit SU-5).

## P20 Timer

**Q-P20a : la ligne "Exemple" (donnée utilisateur, pas dans le code)**
1. **[RECO]** Ne rien supprimer par migration (un `DELETE ... WHERE name = 'Exemple'` toucherait des lignes d'utilisateurs). Le code retire le repli `builtinPresets` ; l'orchestrateur compte en lecture seule les lignes concernées ; la remise à zéro du compte de test (P1) règle l'UAT TI-2.
2. Migration qui supprime les presets nommés `Exemple` (rapide, destructif, irréversible).

**Q-P20b : où apparaissent les presets existants de type `emom`, `hyrox`, `functional`, `rest` ?**
1. **[RECO]** Séance = `custom`, Tabata = `tabata`, Intervalle = tous les autres types : aucun preset existant ne disparaît.
2. Réduire les types à trois et migrer les anciens (perte de nuance `hyrox`/`functional`, réécriture de données).

## P21 Social et Amis

**Q-P21a : qui peut voir le profil public complet ?** (détermine le périmètre du RPC `ziko_get_public_profile`)
1. **[RECO]** Conforme à la maquette D11 : tout utilisateur connecté voit les 9 blocs (le contrat dit "mêmes données publiques"). Le RPC est borné aux champs du contrat, jamais de données de santé ni de poids.
2. Séances, records et défis réservés aux amis ; un non-ami voit nom, objectif, niveau, badges, série, compteurs (état "réservé aux amis" à ajouter en maquette, hors lot D).

**Q-P21b : migration d'intégrité des amitiés en production**
1. **[RECO]** Migration qui (a) supprime les doublons de paires croisées (garde l'acceptée, sinon la plus ancienne), (b) pose l'index unique sur la paire non ordonnée, (c) restreint l'UPDATE au destinataire (aujourd'hui le demandeur peut s'auto-accepter). Avant application : l'orchestrateur compte les doublons en lecture seule et vous les montre.
2. Pas de nettoyage ni d'index : seulement les RPC qui évitent les nouveaux doublons ; la faille d'auto-acceptation reste ouverte (non recommandé).

**Q-P21c : que compte `abonnés` une fois "Suivre" et "ami" fusionnés ?** (le contrat garde le compteur en lecture)
1. **[RECO]** Même définition que le profil perso actuel (`profile/index.tsx`) : abonnés = amitiés acceptées où le profil est destinataire ; `amis` = total des amitiés acceptées.
2. Supprimer le compteur `abonnés` et ne garder que `amis` (simple et sans ambiguïté, écart à la maquette).
3. Créer une vraie table de suivi asymétrique (contredit "une seule notion").

## P22 Journal et Mon coach (aucune maquette)

**Q-P22a : couleur du module Journal** (`lot-C/CRITIQUE.md` Q2 ; le violet actuel `#7B5BD0` est à remplacer)
1. **[RECO]** Sarcelle `#0F766E` (blanc dessus 5,47:1, 5,06:1 sur fond), distincte de l'info `#2563C9` et de l'orange.
2. Bleu ardoise `#3F5F8A` (6,53:1 / 6,04:1).
3. Reprendre l'orange primaire (pas de couleur de module).

**Q-P22b : humeur du Journal et humeur du Quick Log (P8), même donnée ?** (les deux écrivent `ziko_journal_entries`)
1. **[RECO]** Le Journal garde plusieurs entrées par jour (contextes) ; l'humeur du Quick Log (1/jour) est l'entrée du jour `general`, modifiée sur place ; l'accueil affiche la plus récente du jour. Aucun changement de schéma.
2. 1 humeur par jour partout (le Journal édite l'entrée du jour au lieu d'en créer une) : perd l'historique par moment de la journée.
3. Deux données séparées (nouvelle table d'humeur rapide) : doublon à réconcilier.

**Q-P22c : périmètre du design de P22 avant de coder**
1. **[RECO]** UI-SPEC (`/gsd-ui-phase`, skills `impeccable` + design) + 4 à 5 maquettes légères (Mon coach lié, Mon coach dégradé, Journal Aujourd'hui, Journal Historique, états d'erreur), validées avant plan/build, comme les lots A à D.
2. UI-SPEC texte seul puis build directement (plus rapide, risque d'écart visuel avec le reste du produit).
