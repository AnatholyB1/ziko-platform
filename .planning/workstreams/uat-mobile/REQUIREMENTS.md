# Requirements: Ziko Platform — v1.20 UAT Mobile (Refonte & corrections)

**Defined:** 2026-11-12
**Workstream:** `uat-mobile`
**Source:** `.planning/MILESTONE-RECAP-2026-11-12.md` (revue UAT, ~35 captures, discussion écran par écran)
**Core Value:** Un utilisateur a une seule app qui le coache, suit tout, et dit quoi cuisiner selon sa cuisine — en maîtrisant les coûts IA via l'engagement gamifié.

Règles transverses : exécution via `/orchestrate-milestone` (parallélisation max) · UAT faits par Claude sur émulateur Android · maquettes via `impeccable` + skills de design avant toute phase visuelle · jamais d'édition d'une migration existante.

## v1 Requirements (ce milestone)

### Harness UAT (HARN) — vague 0

- [ ] **HARN-01**: Claude peut créer et démarrer un AVD Android avec services Google de façon scriptée
- [ ] **HARN-02**: Claude peut lancer des flows Maestro contre un build de dev de l'app sur l'émulateur
- [ ] **HARN-03**: Un compte de test dédié (athlète + coach lié) existe avec un jeu de données reproductible, réinitialisable à chaque run (identifiants hors repo)
- [ ] **HARN-04**: Chaque flow UAT produit des captures d'écran et des logs conservés comme preuves dans le `VERIFICATION`/`UAT` de la phase
- [ ] **HARN-05**: Claude peut simuler : expiration de session, mise en arrière-plan, position GPS, caméra virtuelle (image de code-barres)
- [ ] **HARN-06**: Les UAT s'exécutent en file sur 1-2 émulateurs sans bloquer le développement parallèle
- [ ] **HARN-07**: Une convention de numérotation des migrations Supabase évite les collisions entre worktrees parallèles

### Session & authentification (SESS)

- [ ] **SESS-01**: Le token de session est rafraîchi au retour de l'app au premier plan
- [ ] **SESS-02**: Une session expirée est détectée et l'utilisateur est redirigé vers la connexion sans devoir fermer l'app
- [ ] **SESS-03**: Aucune action (Journal, Amis, logs…) n'échoue avec "Utilisateur non connecté" alors que la session est valide
- [ ] **SESS-04**: La cause de l'échec d'ajout d'ami depuis la recherche globale est identifiée et corrigée

### Habitudes (HABT)

- [ ] **HABT-01**: L'utilisateur ouvre le module Habitudes via "Tous mes outils" sans écran blanc
- [ ] **HABT-02**: Toute erreur de rendu d'un module affiche un écran d'erreur avec bouton retour fonctionnel (jamais un écran bloquant)

### Entraînement : séance & programmes (TRAIN)

- [ ] **TRAIN-01**: "Allez, c'est parti !" (mission du jour) ouvre la séance prévue avec ses exercices
- [ ] **TRAIN-02**: "Démarrer la séance d'aujourd'hui" (page programme) ouvre la séance prévue avec ses exercices
- [ ] **TRAIN-03**: Une séance sans série validée n'est ni enregistrée ni comptée dans la semaine ou "Récent"
- [ ] **TRAIN-04**: La semaine type d'un programme affiche ses séances sur les bons jours
- [ ] **TRAIN-05**: L'utilisateur ouvre le détail et les stats d'une séance en la touchant dans "Récent"
- [ ] **TRAIN-06**: L'utilisateur voit la liste de tous ses programmes (IA, coach, créés par lui) avec le statut actif
- [ ] **TRAIN-07**: Un seul programme est actif à la fois, avec une règle claire en cas de conflit programme IA / programme coach
- [ ] **TRAIN-08**: Le menu d'un programme masque "Activer" si déjà actif, hiérarchise Activer/Dupliquer/Supprimer et affiche un titre lisible
- [ ] **TRAIN-09**: Après création via l'assistant 4 étapes, la séance est accessible et l'utilisateur peut choisir "Définir comme programme actif"
- [ ] **TRAIN-10**: La séance rapide utilise des Ionicons (pas d'emoji) et des libellés français

### Atelier de création de programme IA (ATEL)

- [ ] **ATEL-01**: L'utilisateur crée un programme en conversation avec une IA (atelier), en complément de l'assistant 4 étapes
- [ ] **ATEL-02**: L'IA de l'atelier a accès à la recherche web
- [ ] **ATEL-03**: L'IA de l'atelier dispose d'une bibliothèque de skills d'entraînement
- [ ] **ATEL-04**: L'IA connaît le contexte complet (données, entraînements passés, programmes précédents)
- [ ] **ATEL-05**: L'utilisateur modifie le programme en direct ou demande à l'IA de le modifier
- [ ] **ATEL-06**: L'atelier permet un programme très précis (ex. powerlifter)
- [ ] **ATEL-07**: Les programmes forment une suite ordonnée (périodisation) dont un seul est actif
- [ ] **ATEL-08**: Le programme suivant est construit en fonction des résultats du précédent
- [ ] **ATEL-09**: À la fin d'un programme, l'atelier se relance automatiquement avec les résultats
- [ ] **ATEL-10**: Les appels IA de l'atelier passent par le système de crédits existant (creditCheck/creditDeduct)

### Accueil & Quick Log (QLOG)

- [ ] **QLOG-01**: Le total d'eau du jour s'affiche sur la tuile eau, avec logs illimités par jour
- [ ] **QLOG-02**: Le poids ne se logue qu'une fois par jour, et le statut "logué" persiste jusqu'au lendemain
- [ ] **QLOG-03**: L'humeur ne se logue qu'une fois par jour, et le statut "logué" persiste jusqu'au lendemain
- [ ] **QLOG-04**: La tuile repas ouvre l'ajout de repas et affiche les kcal du jour
- [ ] **QLOG-05**: La carte score de l'accueil calcule des valeurs correctes et explique un état vide

### Nutrition : ajout de repas (NUTR)

- [ ] **NUTR-01**: L'ajout d'un repas se fait depuis un écran unique, accessible en 1 tap depuis la tuile Repas
- [ ] **NUTR-02**: Le repas est présélectionné selon l'heure et la dernière méthode utilisée est mémorisée
- [ ] **NUTR-03**: Les repas déjà logués aujourd'hui sont visibles dans l'écran d'ajout
- [ ] **NUTR-04**: Recherche, scan, code-barres et saisie manuelle sont accessibles depuis le même écran

### Pantry (PANT)

- [ ] **PANT-01**: Toucher Frigo/Congélateur/etc. ouvre la liste des articles (pas une alerte)
- [ ] **PANT-02**: L'utilisateur ajoute un article à la main
- [ ] **PANT-03**: Le scan d'un code-barres préremplit le formulaire d'ajout
- [ ] **PANT-04**: Chaque onglet (Inventaire, Recettes, Shopping) permet de voir le détail de ses éléments
- [ ] **PANT-05**: Les recettes IA tiennent compte du contenu du pantry et des macros restantes de la journée
- [ ] **PANT-06**: La liste de courses dépend de ce qui manque dans le frigo et accepte des ajouts manuels
- [ ] **PANT-07**: Les libellés du module sont en français (Pantry, Shopping)

### Hydratation (HYDR)

- [ ] **HYDR-01**: Les boutons +250/+500/+750 sont redessinés
- [ ] **HYDR-02**: L'utilisateur modifie ses rappels (on/off, intervalle, plage horaire)
- [ ] **HYDR-03**: L'utilisateur modifie la taille de verre par défaut
- [ ] **HYDR-04**: L'utilisateur active/désactive "compter le café/thé" et règle le pourcentage
- [ ] **HYDR-05**: L'utilisateur modifie le bonus jour de séance (ml)
- [ ] **HYDR-06**: Le champ de saisie de l'objectif reste visible au-dessus du clavier

### Récompenses : succès & boutique (REWD)

- [ ] **REWD-01**: Récompenses a les onglets Niveau / Succès / Boutique / Quêtes
- [ ] **REWD-02**: Succès affiche les 11 succès avec icône propre, condition et progression
- [ ] **REWD-03**: Toucher un succès ouvre une fiche (nom, condition, progression, date de déblocage)
- [ ] **REWD-04**: Les succès sont attribués automatiquement quand la condition est remplie
- [ ] **REWD-05**: La boutique affiche toutes les catégories (titres, badges, thèmes, bannières) sans limite de 8 éléments
- [ ] **REWD-06**: "Mes objets" liste les objets possédés et permet de les équiper
- [ ] **REWD-07**: Le solde de pièces est visible en permanence dans la boutique
- [ ] **REWD-08**: L'utilisateur consulte l'historique de ses gains
- [ ] **REWD-09**: L'utilisateur voit un aperçu d'un objet avant de l'acheter
- [ ] **REWD-10**: La liste statique de secours des badges est supprimée (aucune donnée factice affichée)

### Quêtes (QUEST)

- [ ] **QUEST-01**: Les quêtes sont stockées en base avec une progression calculée à partir des données réelles
- [ ] **QUEST-02**: Les quêtes de départ sont identiques pour tous les utilisateurs
- [ ] **QUEST-03**: L'agent IA dispose d'un outil de gestion de quêtes
- [ ] **QUEST-04**: L'IA crée de nouvelles quêtes à chaque passage de niveau ou quand il n'en reste aucune
- [ ] **QUEST-05**: Au plus 3 quêtes sont actives ; le nombre créé complète ce qui reste
- [ ] **QUEST-06**: L'utilisateur ne peut pas refuser une quête ; chaque quête a une durée limite
- [ ] **QUEST-07**: Une quête expirée reste visible "échouée" hors du compte des 3 jusqu'à son remplacement
- [ ] **QUEST-08**: Les quêtes proposées sont personnalisées selon l'identité de la personne

### Mesures & objectifs (MEAS)

- [ ] **MEAS-01**: Les objectifs de mesures sont stockés en base (réutilisation/extension de `ziko_athlete_goals` à confirmer) et plus codés en dur
- [ ] **MEAS-02**: Les objectifs sont posés à l'onboarding avec l'IA
- [ ] **MEAS-03**: L'agent IA dispose d'un outil de gestion des mesures et objectifs
- [ ] **MEAS-04**: Les mesures proposées incluent poids, tour de taille, bras, poitrine, cuisses, hanches, % de masse grasse
- [ ] **MEAS-05**: Chaque objectif affiche un niveau de complétion (%) entre point de départ et cible
- [ ] **MEAS-06**: L'utilisateur ne modifie pas un objectif en cours ; une fois atteint, il définit le suivant
- [ ] **MEAS-07**: L'IA modifie un objectif en cours uniquement si : stagnation >= 4 semaines, rythme trop rapide/lent, blessure/pause déclarée, ou changement d'objectif principal validé
- [ ] **MEAS-08**: L'utilisateur est prévenu avec la raison de toute modification d'objectif par l'IA
- [ ] **MEAS-09**: Les objectifs de mesures peuvent alimenter les quêtes

### Sommeil (SLP)

- [ ] **SLP-01**: L'utilisateur logue sa nuit à la main (coucher, lever, qualité /5, réveils)
- [ ] **SLP-02**: Sans donnée, l'écran affiche un état vide avec "Logger ma nuit" (plus de données factices)
- [ ] **SLP-03**: Les phases (profond/léger/REM) ne s'affichent que si une source connectée les fournit
- [ ] **SLP-04**: Une source connectée prime sur la saisie manuelle
- [ ] **SLP-05**: Les réglages (cible, rappel coucher, source, réveil intelligent, routine pré-sommeil) sont éditables
- [ ] **SLP-06**: L'accueil et l'écran Sommeil affichent des données cohérentes

### Stretching (STRE)

- [ ] **STRE-01**: La bibliothèque affiche les exercices de stretching
- [ ] **STRE-02**: L'utilisateur crée ses propres exercices de stretching
- [ ] **STRE-03**: L'utilisateur voit, crée et modifie des routines
- [ ] **STRE-04**: Le Suivi affiche séances de la semaine, minutes cumulées, série, dernière séance et calendrier
- [ ] **STRE-05**: L'utilisateur choisit une routine "par défaut"
- [ ] **STRE-06**: La routine par défaut est ajoutée automatiquement au début de chaque séance, passable d'un tap (rien si aucune)

### Compléments (SUPP)

- [ ] **SUPP-01**: Compléments a 4 onglets : Aujourd'hui / Mon stack / Catalogue / Rappels
- [ ] **SUPP-02**: Le Catalogue permet recherche et filtres marque/catégorie
- [ ] **SUPP-03**: Le comparateur de prix avec liens (écrans `SupplementCompareScreen`/`DetailScreen`) est de nouveau accessible
- [ ] **SUPP-04**: L'utilisateur ajoute un produit à son stack avec dose et moment de prise
- [ ] **SUPP-05**: "Mon stack" ne contient que les produits choisis et est éditable
- [ ] **SUPP-06**: Les prix ne s'affichent plus en "NaN€"
- [ ] **SUPP-07**: Les rappels se règlent par moment de la journée (à confirmer en maquette)

### Timer (TIMR)

- [ ] **TIMR-01**: L'utilisateur crée, modifie et supprime ses presets sur les onglets Séance, Tabata et Intervalle
- [ ] **TIMR-02**: Un preset règle nom, effort, repos, séries, rounds + repos entre rounds, échauffement
- [ ] **TIMR-03**: Le preset de test "Exemple" est retiré

### Social & Amis (SOC)

- [ ] **SOC-01**: L'ajout d'ami fonctionne depuis la recherche globale
- [ ] **SOC-02**: Une demande envoyée apparaît dans "En attente" (section envoyées)
- [ ] **SOC-03**: "En attente" sépare reçues (Accepter/Refuser) et envoyées (Annuler)
- [ ] **SOC-04**: "Suivre" et "ami" sont une seule notion ; le bouton reflète l'état (ajouter / demande envoyée / ami)
- [ ] **SOC-05**: Chercher place le champ en haut et recherche en direct, sans bouton "Rechercher"
- [ ] **SOC-06**: Le profil public affiche niveau+XP, badges, série, derniers entraînements, PR, défis en commun, objectif en français, nombre d'amis/abonnés
- [ ] **SOC-07**: Le profil public s'affiche sans avatar ni boutons coupés sous la bannière
- [ ] **SOC-08**: Le texte "Demande envoyée" s'affiche sans échappement unicode brut

### Journal (JRNL)

- [ ] **JRNL-01**: L'enregistrement du Journal fonctionne avec une session valide
- [ ] **JRNL-02**: Les emojis d'humeur sont remplacés par des Ionicons et la couleur du module est cohérente avec la charte (décision en maquette)

### Mon coach (COACH)

- [ ] **COACH-01**: L'écran Mon coach affiche le profil du coach quand un coach est déjà lié
- [ ] **COACH-02**: L'écran Mon coach a un header et un retour cohérents avec les autres écrans, et une UI améliorée

### Corrections transverses (XCUT)

- [ ] **XCUT-01**: Les slugs bruts (`muscle_gain`, `fat_loss`) sont remplacés par des libellés français partout
- [ ] **XCUT-02**: Les textes anglais ("End", mois "May", etc.) sont traduits
- [ ] **XCUT-03**: Les titres ne passent plus sous la barre de statut (safe-area) sur tous les écrans
- [ ] **XCUT-04**: Le bouton bug flottant ne masque aucun bouton d'action
- [ ] **XCUT-05**: Les barres d'onglets ont des marges latérales cohérentes
- [ ] **XCUT-06**: Les noms d'exercices s'affichent en français avec une casse correcte
- [ ] **XCUT-07**: "Coach Ziko · Coach Ziko" n'est plus redondant

### Design (DSGN)

- [ ] **DSGN-01**: Une maquette validée (skills `impeccable` + design) existe avant l'exécution pour : liste des programmes, atelier IA, ajout de repas, Récompenses (Succès/Boutique/Quêtes), Pantry, Stretching, Compléments (catalogue/comparateur), presets Timer, saisie de sommeil, profil public, Amis (En attente)

### Mon coach complet — SEED-002 (MCOA) — phases finales, scope à cadrer en discuss-phase

- [ ] **MCOA-01**: Audit de l'existant (plugin `coach` mandatory, états A/B/C) vs la vision de SEED-002 pour identifier ce qui manque
- [ ] **MCOA-02**: Le plugin Mon coach est pré-installé, non désinstallable et couvre les 3 états (code / aperçu coach / lié)
- [ ] **MCOA-03**: L'utilisateur retire un coach avec une confirmation explicite
- [ ] **MCOA-04**: L'athlète voit le programme prescrit et la carte du coach dans Mon coach

### Factions & Ligues — SEED-001 (LEAG) — phases finales, scope à cadrer en discuss-phase

- [ ] **LEAG-01**: Les factions correspondent aux sports/objectifs (taxonomie des dashboards coach v1.8)
- [ ] **LEAG-02**: Deux pistes de ligue étanches (Habitudes / Performance), sans comparaison entre elles
- [ ] **LEAG-03**: La transition Habitudes -> Performance est décidée par l'IA, avec une célébration
- [ ] **LEAG-04**: Garde-fous : score basé sur la régularité relative, ligues débloquées à un palier, pas de chute sous le palier de départ
- [ ] **LEAG-05**: Défis collectifs coach + athlètes (via `coach_client_links`) plutôt que classement nominatif
- [ ] **LEAG-06**: La couche ligues lit l'état athlète existant (`athlete_state`/`athlete_decisions`) sans dupliquer la logique de niveau

## v2 Requirements (reportés)

- Images et vidéos des exercices de stretching
- Tests UAT parallélisés sur plusieurs émulateurs / complément Expo Web pour les tests purement fonctionnels
- Réseau social ouvert entre utilisateurs inconnus (guildes ouvertes)
- Couche cosmétique/loot visuelle étendue (coffres, skins), saisons/battle pass

## Out of Scope

| Feature | Raison |
|---------|--------|
| Modification libre d'un objectif de mesure par l'utilisateur | Décision : seule l'IA modifie, sous conditions |
| Refus d'une quête par l'utilisateur | Décision : quêtes imposées avec durée limite |
| Connexion Google automatisée pour les UAT | Non automatisable (validation sur appareil) ; compte de test email/mot de passe |
| UAT via Expo Web | MMKV non supporté sur le web et le web ne reproduit pas les problèmes natifs |
| Tirage aléatoire de récompenses | Contrainte ANJ (pool choisi par l'IA) |

## Traceability

(Rempli par le roadmapper)

| Requirement | Phase | Status |
|-------------|-------|--------|
