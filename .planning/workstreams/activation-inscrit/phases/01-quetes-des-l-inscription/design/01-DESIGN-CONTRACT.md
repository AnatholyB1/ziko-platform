# Phase 1 — Quêtes dès l'inscription : contrat de design

Workstream `activation-inscrit` · Reqs QNEW-01..07, CLAR-03, CLAR-04 · Surface : bloc « Quêtes du jour » de l'accueil mobile (`apps/mobile/app/(app)/index.tsx`). Design pur, aucun code d'app.
Prototypes : `with-content.html` / `without-content.html` (7 états chacun), PNG 390x844 DPR2 dans `png/`, galerie `index.html`, mesures `frames.json`, générateur `build.mjs`. La maquette gagne sur toute divergence (rendu exact, D-06 de la v1.20).

## 1. Faits du code qui cadrent le design (vérifiés)
- Niveau 1 ouvert (`manifest.minLevel`) : hydration, nutrition, habits, timer, stretching, rpe, ai-programs, coach. Verrouillés : journal, measurements, pantry, sleep, stats, persona (2) ; gamification = Récompenses, cardio, community, wearables (3) ; supplements (4). L'entraînement (`/(app)/workout`) n'est pas un plugin, donc jamais verrouillé.
- Conséquence : **le bloc n'a aucun lien « Tout voir » vers Récompenses au niveau 1** (écran niveau 3, QNEW-05). Le détail des quêtes reste dans l'accueil.
- Les 3 quêtes de départ en base (`ziko_quest_templates`, migration `20261201130100`) sont : séance du jour (workout_sessions, 1, 25 pièces), 2 L d'eau (hydration_ml, 2000, 15), « S'entraîner 3 fois » hebdo (workout_sessions, 3, 60). Aucune ne cible un écran verrouillé, mais **aucune ne couvre la nutrition alors que la métrique `nutrition_logs` existe**. La maquette montre le jeu recommandé : eau, repas, séance (3 actives = plafond `MAX_ACTIVE_QUESTS`). Cela suppose un template starter « repas » (15 pièces) : migration de seed à confirmer au plan. La quête hebdo est reportée (Q1 de la critique).
- Ordre : eau en premier (CLAR-03 : la première mission est l'hydratation, la première quête aussi).
- Données : `parseQuestSync` (`plugins/gamification/src/quests.ts`) fournit déjà titre, icône, métrique, cible, progression, statut ; `progressText`, `questRatio`, `completedNote`, `questToastText` sont réutilisés tels quels. Les quêtes `expired` ne sont **jamais rendues** sur l'accueil (QNEW-07).

## 2. Placement et pile de l'accueil
Ordre vertical, marge basse 12 dp entre cartes sauf indication : ... anneau Forme du jour → **[RÉSERVE PHASE 2 : « Crée ton premier entraînement »]** → Mission du jour → (20 dp) **Quêtes du jour** → AICoachInline → reste.
- Réserve Phase 2 : hauteur 176 dp, marge basse 12 dp, rendue en pointillé bleu « PHASE 2 » dans les prototypes (annotation, pas du design final). La phase 2 décide de son contenu ; la phase 1 ne code que l'insertion sous elle (aucun couplage : le bloc Quêtes ne lit pas l'état de cette carte).
- Le bloc Quêtes ne dépend pas de la présence de la Mission ni de la carte Phase 2 (variante `without-content`).
- Pas de carte dans une carte : un en-tête de section (surtitre) + **une seule carte** `card np` contenant les lignes séparées par un filet 1 dp. Cohérent avec l'onglet Quêtes B12 (v1.20).

## 3. Tokens
Hérités de la v1.20 (`phases/04-maquettes-reference/shared/DESIGN-SYSTEM.md`) ; `design/tokens.css` en est une copie.
| Rôle | Valeur |
|---|---|
| Fond / surface / bord | `#F7F6F3` / `#FFFFFF` / `#E2E0DA` |
| Primaire / teinte / texte orange | `#FF5C1A` / `#FFF0E8` (bord `#FFD2BC`) / `#B53D05` |
| Texte / muted | `#1C1A17` / `#6B6963` |
| Succès / teinte / bord | `#17703D` / `#E6F4EC` / `#BFE1CC` |
| Pièces (icône / texte / teinte) | `#9A6F00` / `#7A5800` / `#FBF1D3` |
| Info (eau) | icône `#2563C9` sur `#E8F0FD` ; l'app utilise `#1E6FB8` sur `#E3EEF9` dans QuestsTab : garder ces deux valeurs de l'app |
| Erreur | `#B5301F`, teinte `#FBE9E7`, bord `#F0C9C5` |
| Carte | rayon 16, bord 1 dp, ombre `#1C1A17` @0.08 rayon 12 elevation 3 |
Typo : surtitre Geist 600 12 majuscules espacées ; titre de quête Manrope 700 15 ; action et progression Geist 14 (muted) ; pièces Geist 700 13 ; bouton Geist 600 14 ; titre d'état Manrope 700 17. Aucun texte < 12 (hors carte Mission existante à 11, non modifiée).
Espacements : ligne min 84 dp, padding 12/14, gap icône-texte 12, gap interne texte 4, en-tête 20 dp au-dessus / 8 dp en dessous. Icône de quête 44x44 rayon 12.

## 4. Anatomie d'une ligne active (QNEW-03, QNEW-04)
`[icône 44] [titre / action / barre + compteur + pièces] [bouton « Verbe > » 44 dp de haut]`
- Titre (max 2 lignes), **action concrète** sur la ligne suivante (QNEW-04), barre 6 dp (piste `#F0EFE9`, remplissage primaire) + compteur `0 / 2 L` uniquement si cible > 1 (règle existante de `progressText`) + pièces à droite de la barre.
- **Bouton d'action** : pastille teinte primaire, libellé verbe + chevron, hauteur 44, largeur min 44. Toute la ligne est aussi pressable (même cible). Un tap = `router.push` direct vers l'écran de la quête (jamais via Récompenses). Les destinations sont tenues par une table `métrique -> route` validée par `isPluginRouteLocked` ; une quête dont la route est verrouillée n'est pas affichée (filet de sécurité de QNEW-05).
- Table des CTA au niveau 1 :
| Quête (slug) | Libellé | Route |
|---|---|---|
| Bois 2 litres d'eau | Boire | `/(plugins)/hydration/dashboard` |
| Ajoute un repas | Ajouter | `/(plugins)/nutrition/log` |
| Termine une séance | Séance | `/(app)/workout` |
| (hebdo) S'entraîner 3 fois | Séance | `/(app)/workout` |
- Ligne terminée : icône `checkmark-circle` succès, titre inchangé, sous-titre vert « Terminé · +15 pièces récupérées » (`completedNote`), plus de barre ni de bouton.
- Ordre : actives d'abord (ordre `sort_order`), terminées en dernier **à la relecture suivante** ; pendant la session la ligne terminée reste en place (pas de saut de mise en page).

## 5. États (tous rendus dans les prototypes)
| # | État | Cadre | Contenu | Règle |
|---|---|---|---|---|
| 1 | Trois actives | `*-trois` | 3 lignes actives, en-tête « 3 en cours » | état d'un compte neuf à t0 |
| 2 | Mix | `*-deux` | 2 actives + 1 terminée, « 2 en cours » | progression partielle `1,2 / 2 L` |
| 3 | Vient d'être terminée | `*-terminee` | ligne qui passe au vert + pastille « +15 » + toast en haut | QNEW-06 : sans relancer l'app (via `requestQuestRefresh` puis invalidation de la requête quêtes) |
| 4 | Toutes terminées | `*-toutes` | une carte verte : « Bravo, tout est fait », « De nouvelles quêtes arrivent bientôt. », « +55 pièces gagnées » | pas de CTA, pas de ligne par quête |
| 5 | Chargement | `*-chargement` | 3 squelettes de ligne (gris `#ECEAE4`), pas de texte | `accessibilityState busy` |
| 6 | Création en cours | `*-creation` | carte « Tes quêtes se préparent » + icône `sync-outline` | lecture OK mais 0 quête et synchro en vol (QNEW-01/02). Après 10 s sans quête : même carte, bouton « Réessayer » ajouté |
| 7 | Erreur | `*-erreur` | carte « Quêtes indisponibles » + bouton « Réessayer » 48 dp | seul le bloc est en erreur, l'accueil reste utilisable |
Cas limites : 1 seule quête active (même ligne, en-tête « 1 en cours ») ; plus de 3 jamais affichées (serveur plafonne, UI tronque à `MAX_ACTIVE_QUESTS` par sécurité) ; titre long = 2 lignes, la ligne grandit (min-height, pas de hauteur fixe) ; `expired` filtrées. En-tête : « N en cours » ; si toutes terminées « 3 sur 3 » ; jamais de décompte négatif, de « manqué », de « échoué », de « expiré », de flamme de série perdue.
**Philosophie non punitive** : aucun état ne montre un retard. Le seul chrono visible est absent de l'accueil (le renouvellement « se renouvelle dans X h » reste dans l'onglet Récompenses, hors niveau 1).

## 6. Microcopy (français, tutoiement, sans emoji)
Section : « Quêtes du jour » (surtitre) · « 3 en cours » / « 2 en cours » / « 1 en cours » / « 3 sur 3 ».
Quêtes : « Bois 2 litres d'eau » / « Ajoute chaque verre dans Hydratation. » / bouton « Boire » · « Ajoute un repas » / « Note ton premier repas dans Nutrition. » / « Ajouter » · « Termine une séance » / « Lance une séance depuis l'onglet Séance. » / « Séance ».
Terminé : « Terminé · +15 pièces récupérées » · toast `questToastText` : « Quête terminée : Bois 2 litres d'eau (+15 pièces) » · plusieurs : « 2 quêtes terminées (+40 pièces) ».
Tout fait : « Bravo, tout est fait » · « De nouvelles quêtes arrivent bientôt. » · « +55 pièces gagnées ».
Création : « Tes quêtes se préparent » · « Elles s'affichent ici dans un instant. » · (après 10 s) bouton « Réessayer ».
Erreur : « Quêtes indisponibles » · « Impossible de charger tes quêtes. Vérifie ta connexion puis réessaie. » · « Réessayer » (mêmes mots que `QuestsTab`).
Pas de point d'exclamation hors « Bravo ». Pas de « Tout voir ».

## 7. Mouvement (transform / opacity uniquement)
- Apparition du bloc : fondu 200 ms `cubic-bezier(.25,1,.5,1)`, décalage Y 8 dp, lignes en cascade 40 ms.
- Complétion (état 3) : fond de ligne surface -> `#E6F4EC` 250 ms ; icône swap avec échelle .8 -> 1, 200 ms ; barre -> 100 % en 300 ms avant le swap ; pastille « +15 » monte de 8 dp en fondu 600 ms puis reste ; retour haptique léger `notificationSuccess` (optionnel, désactivable) ; toast 3 s, entre par le haut (translation Y 150 ms).
- Appui : 100 ms, échelle .98 + fond `#F0EFE9`.
- Squelette : balayage 1,5 s `#ECEAE4`/`#F4F3EE`.
- **Reduced motion** (`AccessibilityInfo.isReduceMotionEnabled`) : pas de cascade, pas de montée de pastille (apparition fixe), couleur de ligne instantanée, barre sans animation, squelette fixe `#ECEAE4`, toast en fondu 100 ms sans translation.

## 8. Accessibilité
- Section : titre `accessibilityRole="header"` « Quêtes du jour ».
- Ligne active : `accessible` + libellé « {titre}. {compteur ou En cours}. Récompense {n} pièces. {action} » ; rôle `button`, libellé d'action du bouton : « Boire de l'eau, ouvrir Hydratation » / « Ajouter un repas, ouvrir Nutrition » / « Lancer une séance, ouvrir l'onglet Séance ». Le bouton et la ligne ne sont qu'un seul élément focalisable (pas de doublon).
- Barre : `progressbar` + `accessibilityValue {min:0,max:100,now}` (composant `ProgressBar` de l'onglet Quêtes).
- Ligne terminée : « {titre}. Terminé, plus {n} pièces récupérées », non pressable.
- Complétion : annonce `AccessibilityInfo.announceForAccessibility(questToastText)`. L'état n'est jamais porté par la couleur seule (mot « Terminé » + icône coche).
- Erreur : `accessibilityRole="alert"` sur le message ; chargement : `accessibilityState={{busy:true}}`.
- Texte jusqu'à 130 % (dynamic type) sans coupure du libellé de bouton : la ligne grandit, le bouton passe sous le texte si besoin (≥ 130 %).

## 9. Critères d'acceptation mesurables (émulateur Android, compte neuf, capture 1080x2400 / 420 dpi = 390 dp)
| ID | Critère | Mesure |
|---|---|---|
| A1 | Compte tout juste créé : ≤ 3 quêtes actives visibles sans avoir ouvert Récompenses | requête `ziko_user_quests` du compte : count(status='active') ≤ 3 et ≥ 1 ; capture accueil |
| A2 | Second chargement et relance de l'app : aucun doublon | count des lignes `(user_id, slug, period_start)` identique avant/après 2 relances ; contrainte unique présente |
| A3 | Chaque ligne active montre titre, action, barre, bouton | uiautomator : 4 éléments par ligne ; libellés = §6 |
| A4 | Tap sur chaque bouton ouvre l'écran prévu en un tap, sans retour à l'accueil | Maestro : tap -> `assertVisible` sur l'écran cible (Hydratation, journal de repas, Séance) ; route finale ≠ `/` |
| A5 | Aucun bouton de quête ne mène à un écran verrouillé au niveau 1 | test unitaire : pour toute route de la table §4, `isPluginRouteLocked(route, 1) === false` |
| A6 | Complétion visible sans relance | loguer 2 L d'eau puis revenir à l'accueil : la ligne passe en « Terminé » en ≤ 3 s sans relance (debounce `QUEST_REFRESH_DELAY_MS` 1500 ms + requête) ; toast présent |
| A7 | Aucune quête échouée ou expirée affichée | grep des libellés rendus : 0 occurrence de « expir », « échou », « manqu », « Non terminée » dans le bloc ; test : une quête `expired` en entrée ne produit aucune ligne |
| A8 | Première mission du compte de niveau 1 = hydratation et son bouton n'est pas renvoyé à l'accueil | backend : `micro_action = 'hydration_log'` ; Maestro : tap « C'est parti » de Mission du jour -> écran Hydratation |
| A9 | Cibles tactiles ≥ 44x44 dp | uiautomator `bounds` de tout clickable du bloc ; prototype : `frames.json` `bad` = 0 sur 14 cadres (mesuré) |
| A10 | Texte ≥ 14 sp (sauf surtitre 12 et pièces 13) ; aucun < 12 | rendu : `small` = 0 sur 14 cadres (mesuré, hors carte Mission existante à 11) |
| A11 | Contraste texte >= 4.5:1 (hors blanc sur `#FF5C1A`, exception déjà soumise en v1.20) ; texte orange = `#B53D05` | `contrast.mjs` v1.20 sur `#B53D05/#FFF0E8`, `#7A5800/#FBF1D3`, `#17703D/#E6F4EC`, `#6B6963/#FFFFFF` |
| A12 | Dernier élément du scroll >= 100 dp au-dessus du bas | `paddingBottom: 100` ; capture accueil scrollée à fond |
| A13 | Marges latérales 16 dp, carte rayon 16, bord 1 dp `#E2E0DA`, ombre RN | inspection du rendu ; tolérance ±4 dp, ±2 sp |
| A14 | Aucun emoji | regex `\p{Extended_Pictographic}` sur les libellés = 0 (prototype : mesuré `emoji:false` sur 14 cadres) |
| A15 | Insertion sous la carte Phase 2 sans retouche du bloc | l'ordre des cartes : Quêtes toujours après Mission du jour ; ajouter/retirer la carte Phase 2 ne change pas la hauteur du bloc |
| A16 | Erreur : le bouton « Réessayer » relance la lecture et l'accueil reste interactif | Maestro avec réseau coupé puis rétabli |
| A17 | Reduced motion | `reduceMotion` actif : aucune animation de cascade/pastille/barre (revue de code + capture) |

## 10. Traçabilité exigence -> écran -> critère
| Exigence | Écran / état | Critère |
|---|---|---|
| QNEW-01 quêtes actives dès l'arrivée | Accueil, états 1 et 6 (création) | A1, A2 |
| QNEW-02 pas de dépendance à Récompenses, pas de doublon | Aucun écran (synchro déclenchée par l'accueil, migration) ; état 6 | A1, A2 |
| QNEW-03 bloc 3 max, titre, progression, complétion | Accueil états 1, 2, 3, 4 | A1, A3 |
| QNEW-04 action + un tap | Ligne active §4 | A3, A4 |
| QNEW-05 aucun écran verrouillé au niveau 1 | Table CTA §4, pas de « Tout voir » | A4, A5 |
| QNEW-06 mise à jour sans relance | État 3 | A6 |
| QNEW-07 aucune quête échouée | Tous états ; `expired` filtré | A7 |
| CLAR-03 première mission = hydratation (backend) | Mission du jour (carte existante, citée dans la pile) ; 1re quête = eau | A8 |
| CLAR-04 bouton de la première mission jamais renvoyé à l'accueil | Mission du jour -> Hydratation | A8 (garde de route : `isPluginRouteLocked` + route hydratation à niveau 1) |

## 11. Hors périmètre / à ne pas toucher
Carte Mission du jour (existante, rayon 12, fond sombre) : citée pour la pile, non redessinée en phase 1 ; son overline à 11 sp est un écart connu de G2, hors phase. Écran Récompenses : inchangé (seule la synchro en sort). Économie de pièces : inchangée.
