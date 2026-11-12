# Récap UAT mobile — base du prochain milestone (2026-11-12)

Source : ~35 captures d'écran de l'app mobile (Android) + discussion écran par écran avec l'utilisateur.
Statut : **à relire par l'utilisateur** avant `/gsd-new-milestone`.

Règles de travail décidées :
- Exécution via `/orchestrate-milestone`, avec le **maximum de parallélisation** (worktrees, phases indépendantes en vagues).
- **Les tests UAT sont faits par Claude** (pas par l'utilisateur) -> un chantier "harness UAT" est nécessaire (voir chantier 0).
- **Maquettes** : skills `impeccable` + skills de design (`/gsd-ui-phase` avant plan/exécution des phases visuelles). Charte : thème clair, tokens Ziko, Ionicons, pas d'emoji, inline styles.
- Tout ce qui est marqué "recherche + maquette" est à traiter en phase de recherche/UI avant d'implémenter.

---

## 0. Harness UAT (prérequis, pour que Claude teste lui-même)
- Compte de test dédié (athlète, + un coach lié), données de seed reproductibles.
- **Décision (2026-11-12) : émulateur Android seul** (pas d'Expo Web : MMKV non supporté sur web, et le web ne reproduit pas les problèmes natifs — safe-area, clavier, bouton flottant, ombres, alertes natives). Un seul chemin de test, fidèle à l'Android de l'utilisateur.
- État de la machine : Android SDK, émulateur et `adb` déjà installés (`C:\Users\Anatholy\AppData\Local\Android\Sdk`), virtualisation active, 16 Go de RAM. **Manquants : aucun AVD créé, Maestro non installé.**
- À faire : créer un AVD avec services Google (pour notifications push / Health Connect), installer Maestro (flows scriptés), pilotage `adb` (captures, caméra virtuelle pour le scan code-barres, GPS simulé, mise en arrière-plan/expiration de session).
- Limite connue : 1 émulateur (2 max) en parallèle avec 16 Go -> les validations UAT passent **en file** ; le code, les migrations et les maquettes restent parallèles. Le web pourra être ajouté plus tard en complément pour des tests purement fonctionnels si la file est trop lente.
- Connexion par **email + mot de passe** sur un compte de test dédié (le tunnel Google n'est pas automatisable). Identifiants du compte de test hors repo.
- Captures d'écran et logs comme preuves dans chaque `VERIFICATION`/`UAT`.
- Mécanisme pour simuler l'expiration de session (cf. chantier 1).

## 1. Auth / session (priorité haute, transverse)
- Après inactivité, la session expire mais l'app reste accessible -> actions en erreur "Utilisateur non connecté" ; il faut fermer/relancer l'app.
- À faire : rafraîchissement du token au retour au premier plan, détection d'expiration, redirection propre vers login.
- À vérifier : l'échec "Impossible d'envoyer la demande" (recherche globale, ajout d'ami) a-t-il la même cause ? (échoue aussi sans retour d'inactivité)

## 2. Crash bloquant : module Habitudes (priorité haute)
- Ouvert via Accueil > "Tous mes outils" : écran visible 0,5 s puis écran blanc, utilisateur bloqué. À chaque fois.

## 3. Entraînement : séance, programmes, atelier IA
**Bugs**
- "Allez, c'est parti !" (mission du jour) et "Démarrer la séance d'aujourd'hui" ouvrent une **séance rapide vide** au lieu de la séance prévue (Full Body Power, 8 exos). À chaque fois.
- Une séance sans série validée ne doit **pas** être enregistrée ni compter (règle validée) -> corrige les séances "0 min" et le compteur "2/4".
- Page programme `muscle_gain` : tous les jours "Repos" alors que le programme a une séance.
- Séances créées par l'assistant 4 étapes : vérifier qu'elles sont accessibles ensuite ; proposer "Définir comme programme actif ?".
**Fonctionnalités**
- Tap sur une séance de "Récent" -> détail + stats de la séance.
- Liste de **tous** les programmes (IA, coach, créés par l'utilisateur) + vérifier le conflit programme IA / programme coach (lequel est actif). **Recherche + maquette.**
- Menu programme : "Activer" masqué si déjà actif, hiérarchie des boutons (Activer/Dupliquer/Supprimer), titre lisible.
- **Atelier de création de programme** (conversation avec une IA) : accès recherche web + bibliothèque de skills d'entraînement ; contexte utilisateur complet (données, entraînements et programmes passés) ; l'utilisateur modifie en live ou demande à l'IA de modifier ; cas type : programme précis powerlifter. L'assistant 4 étapes reste pour les cas simples.
- **Périodisation** : un seul programme actif à la fois ; les programmes forment une suite où chacun dépend des résultats du précédent (ex. capacité de travail -> exposition -> single lourd en compétition). **À la fin d'un programme, l'atelier se relance automatiquement** avec les résultats.
- Séance rapide : remplacer l'emoji par Ionicons, "End" -> français.

## 4. Accueil & Quick Log
- Eau : total du jour affiché (aujourd'hui "0.00L" après +250ml) ; logs illimités.
- Poids : **1 par jour** ; Humeur : **1 par jour** ; statut "logué" qui **persiste** jusqu'au lendemain (aujourd'hui il s'efface).
- Repas : la tuile ouvre l'ajout de repas ; afficher les kcal du jour.
- Carte score en haut (score 0 / jauge vide), titres sous la barre de statut, slug `muscle_gain`, "Coach Ziko · Coach Ziko", noms d'exercices en anglais minuscules, bouton bug qui cache "Repas".

## 5. Nutrition : ajout de repas + Pantry
- Ajout de repas : trop de clics, plusieurs écrans, erreurs de choix repas/méthode, on ne voit pas ce qui a déjà été mangé. **Recherche + maquette** (pistes : repas présélectionné selon l'heure, dernière méthode mémorisée, récap du jour visible).
- Pantry : tap sur Frigo -> liste des articles (pas une alerte) ; détail de chaque onglet ; ajout à la main ou **scan code-barres qui préremplit le formulaire** ; recettes IA tenant compte des **macros restantes du jour** ; Shopping = ce qui manque dans le frigo + ajouts manuels. Libellés en français (Pantry, Shopping).

## 6. Hydratation
- Boutons +250/+500/+750 à redessiner (aspect actuel jugé laid).
- Réglages : les 4 lignes sont **non cliquables** -> les rendre éditables : Rappels (on/off, intervalle, plage horaire), Taille de verre, Café/thé (on/off + %), Bonus jour de séance (ml).
- Modification de l'objectif : champ visible au-dessus du clavier (le clavier le cache).

## 7. Récompenses : succès, boutique, quêtes
**État constaté** : l'onglet Badges affiche en réalité les articles de boutique `category='badge'` (8 premiers seulement : Cœur et Dragon absents), avec une étoile générique au lieu des emojis en base. Les 11 vrais succès (`ziko_badge_definitions`) ne sont pas affichés et aucun n'est attribué. Quêtes = tableau codé en dur copié de la maquette (`GamificationPlugin.tsx`), progression inventée, aucune table en base.
**Cible**
- Onglets : Niveau / **Succès** / **Boutique** / Quêtes. Boutique avec sélecteur "Boutique / Mes objets" (équiper). Catégories : titres, badges, thèmes, bannières.
- Succès : icône propre par badge, condition visible, progression, fiche au tap, date de déblocage.
- Boutique : solde de pièces visible, **historique des gains**, **aperçu avant achat**.
- Quêtes : quêtes de départ identiques pour tous ; **outil de gestion de quêtes pour l'agent IA** ; l'IA crée de nouvelles quêtes **à chaque passage de niveau ou quand il n'en reste aucune**, selon l'identité de la personne ; max **3 actives** ; l'utilisateur **ne peut pas refuser** ; chaque quête a une **durée limite** ; une quête expirée reste visible "échouée" tant qu'elle n'est pas remplacée, sans compter dans les 3 ; le nombre créé complète ce qui reste. Possible couplage avec les objectifs de mesures.

## 8. Mesures & objectifs
- Objectifs actuellement **codés en dur** (76 kg / 78 cm / 40 cm, `MeasurementsPlugin.tsx`) ; table `ziko_athlete_goals` à examiner pour réutilisation.
- Cible : objectifs posés à l'**onboarding avec l'IA** ; **outil de gestion de mesures/objectifs** pour l'agent ; **niveau de complétion** (%) par objectif ; mesures proposées : poids, tour de taille, bras, poitrine, cuisses, hanches, % masse grasse.
- L'utilisateur **ne modifie pas** un objectif en cours ; une fois atteint il définit le suivant ; seule l'IA modifie si : stagnation >= 4 semaines, rythme trop rapide/lent, blessure/pause déclarée, changement d'objectif principal validé par l'IA. L'utilisateur est prévenu avec la raison.

## 9. Sommeil
- "Cette nuit" (8h00, score 100) est codé en dur ; réglages non fonctionnels ; aucune saisie manuelle sans montre.
- Cible : saisie manuelle (coucher, lever, qualité /5, réveils) ; état vide + bouton "Logger ma nuit" quand aucune donnée ; phases (profond/léger/REM) seulement si une source les fournit ; la source connectée prime sur la saisie manuelle ; réglages éditables.

## 10. Stretching
- Bibliothèque vide malgré "6 exercices essentiels" ; pas de création de routine ; Suivi vide.
- Cible : afficher exercices et routines ; **créer ses exercices** et **ses routines** ; Suivi (séances de la semaine, minutes cumulées, série, dernière séance, calendrier) ; pas d'images/vidéos pour l'instant (plus tard) ; **routine par défaut ajoutée automatiquement au début de chaque séance** (passable d'un tap ; rien si aucune routine par défaut).
- Barre d'onglets sans marge (bords écran).

## 11. Compléments
- Données intactes en base (1 624 produits, 3 858 prix, 11 marques, 12 catégories) et écrans `SupplementCompareScreen` / `SupplementDetailScreen` + routes `compare`/`detail` existent, **mais plus aucune entrée** : l'écran n'a que 3 onglets.
- Cible : 4 onglets — Aujourd'hui / Mon stack (produits choisis, dose, moment, éditable) / **Catalogue** (recherche, filtres marque/catégorie, comparateur de prix avec liens, "Ajouter au stack") / Rappels (par moment de la journée, à confirmer en maquette). Corriger "NaN€".

## 12. Timer
- Création/édition/suppression de **presets** sur les 3 onglets (Séance, Tabata, Intervalle) : nom, effort, repos, séries, rounds + repos entre rounds, échauffement. Retirer le preset de test "Exemple".

## 13. Social / Amis
- Ajout d'ami depuis la recherche globale : échoue. Depuis l'écran Amis : la demande déjà envoyée n'apparaît pas dans "En attente" et on ne peut pas la renvoyer.
- "Suivre" et "ami" = **même notion** ; bouton selon l'état (ajouter / demande envoyée / ami).
- "En attente" : deux sections — reçues (Accepter/Refuser) et envoyées (Annuler).
- Chercher : champ **en haut**, recherche **en direct** (sans bouton), texte "Demande envoyée" à corriger.
- Profil public (depuis la liste d'amis) : avatar/boutons coupés sous la bannière ; afficher niveau+XP, badges, série, derniers entraînements, PR, défis en commun, objectif en français, nombre d'amis/abonnés.

## 14. Journal
- Erreur "Utilisateur non connecté" à l'enregistrement (chantier 1). Emojis d'humeur -> Ionicons ; couleur violette à revoir.

## 15. Mon coach
- Afficher le **profil du coach** quand un coach est déjà lié ; améliorer l'UI (header/retour cohérents, placeholder).

## 16. Corrections transverses
- Slugs bruts (`muscle_gain`, `fat_loss`) -> libellés français.
- Textes anglais : "End", "Pantry", "Shopping", mois "May".
- Titres qui passent sous la barre de statut (accueil, assistant Coach IA, écrans scrollés).
- Bouton bug flottant qui cache des boutons d'action.
- Barres d'onglets sans marge (Stretching, Sommeil).
- Écran blanc 16:03 = module Habitudes (chantier 2).

## 17. Design (maquettes)
- Skills `impeccable` + skills de design. Écrans à maquetter en priorité : liste des programmes, atelier IA, ajout de repas, Récompenses (Succès/Boutique/Quêtes), Pantry, Stretching (bibliothèque/routines/suivi), Compléments (catalogue/comparateur), presets Timer, saisie de sommeil, profil public, Amis (En attente).

---

## Pistes de parallélisation (à affiner en phase de planification)
- **Vague 0** : harness UAT émulateur (bloque la validation de tout le reste) + chantiers 1 et 2 (crash Habitudes, session) — indépendants. Les UAT passent ensuite en file sur l'émulateur (1-2 instances).
- **Vague 1 (indépendantes, worktrees séparés)** : 3 Entraînement (bugs) · 6 Hydratation · 12 Timer · 13 Social · 11 Compléments · 10 Stretching · 9 Sommeil.
- **Vague 2 (dépendent d'outils IA / design)** : atelier IA + périodisation · quêtes · mesures/objectifs · nutrition/Pantry · Récompenses.
- Les migrations Supabase se touchent : numéroter à l'avance pour éviter les collisions entre worktrees (jamais d'édition d'une migration existante).
