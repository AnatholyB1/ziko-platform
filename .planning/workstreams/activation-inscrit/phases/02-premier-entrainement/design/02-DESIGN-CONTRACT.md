# Contrat de design, Phase 2 : Premier entraînement & parcours clarifié

Milestone v1.21, workstream `activation-inscrit`. Exigences : FWKO-01..07, CLAR-01, CLAR-02. Maquettes : `index.html` (galerie), `frames/png/*.png` (390x844, DPR 2), sources `frames/src/` (générées par `shared/gen.mjs`, rendues par `shared/build.mjs`). Thème clair uniquement. Socle réutilisé de v1.20 Phase 4 : `shared/tokens.css`, règles G1 à G9 de `.planning/workstreams/uat-mobile/phases/04-maquettes-reference/shared/DESIGN-SYSTEM.md` (elles s'appliquent toutes ici). Les données d'exemple (« Léa », 6 crédits, 4 crédits) sont des placeholders. La maquette gagne sur toute divergence ; les valeurs de crédits sont lues sur le serveur, jamais codées en dur.

## 1. Faits du code qui fondent les décisions (relevés au 2026-11-20)
| Fait | Source | Conséquence de design |
|---|---|---|
| Le bouton « Créer un programme » de l'onglet Entraînement ouvre `ai-generate`, un assistant de séance unique | `workout/index.tsx` l.882 | Faux libellé : CLAR-01 |
| Le bouton « + » de l'en-tête de l'onglet ouvre aussi `ai-generate`, sans libellé accessible | `workout/index.tsx` l.557 | Libellé « Créer » + ouvre le choix (voir 4.2) |
| `program-builder` : 4 étapes Objectif, Durée, Jours, Exercices. Le texte de `programs.tsx` dit « Objectif, niveau, jours, matériel » | `program-builder.tsx`, `programs.tsx` l.405 | Le texte des maquettes suit le builder réel ; corriger `programs.tsx` au passage |
| L'IA « programme » coûte 4 crédits (quota gratuit 1 par mois + 1 bonus) ; l'atelier est une conversation à 4 crédits par message (1 message gratuit par jour) | `backend/api/src/config/credits.ts` | Les deux coûts diffèrent d'unité (par séance / par message) : le libellé le dit |
| L'atelier lit déjà son coût réel (`info.cost`, `free_left`) et affiche le solde ; `costLabel` a un repli « Consomme des crédits IA » | `atelier.tsx`, `lib/atelier.ts` | Réutiliser ces valeurs et ce repli ; aucun chiffre en dur |
| L'écran « Crédits épuisés » existe (`useCreditStore.showExhaustionSheet`) | `atelier.tsx` l.181 | Un tap sur un chemin IA épuisé l'ouvre, on ne redessine pas |
| La carte Mission du jour, sans programme et sans mission, affiche « Aucun programme actif / Créer un programme IA » (vers `ai-programs/dashboard`) | `(app)/index.tsx` l.130-165 | Doublon et 4e chemin : voir règle R5 |
| Fin d'onboarding : « Ton plan est prêt », « Première séance demain matin », carte « Ton programme Push / Pull / Legs 8 semaines », chargement « Construction de ton programme » ; rien n'est créé ; la suite réelle est `ziko-chat` | `step-7.tsx` | CLAR-02 : voir section 6 |

## 2. Carte « Crée ton premier entraînement » (accueil)
### 2.1 Règles de visibilité (FWKO-01, FWKO-06)
- **R1** Affichée si et seulement si : aucun programme actif (IA, créé ou coach : même lecture que `useActiveAIProgram` / `activeProgramView`) ET zéro séance terminée. Un programme en pause seul ne compte pas comme actif : la carte s'affiche.
- **R2** Position : toute première carte du contenu, sous l'en-tête (salutation), AU-DESSUS de la carte Mission du jour et du bloc Quêtes (phase 1). Ordre : salutation, carte P2, Mission du jour, Quêtes, reste.
- **R3** Disparition immédiate (invalidation de la requête, sans relancer l'app) dès qu'un programme devient actif ou qu'une séance est terminée. Aucun message d'adieu, aucune animation de sortie longue : fondu 150 ms puis le contenu remonte.
- **R4** Une lecture en erreur ne montre jamais la carte comme si le compte était vide (même principe que le run 7 de l'onglet) : en cas d'erreur de lecture, la carte est masquée.
- **R5** Quand la carte est visible, la variante vide de la carte Mission du jour (« Aucun programme actif », bouton vers `ai-programs/dashboard`) n'est PAS affichée : elle dupliquerait la carte avec un 4e chemin. La Mission d'onboarding (hydratation, etc.) reste affichée (« cohabite », FWKO-06). Voir question Q2 du CRITIQUE.
- **R6** Pas de bouton « Masquer ». (Question Q4.)

### 2.2 Anatomie (H01)
Une seule carte standard (rayon 16, bord 1 px `#E2E0DA`, ombre `#1C1A17` @ 0.08 / rayon 12 / elevation 3), padding 0, rangées séparées par un filet 1 px (pas de carte dans la carte).
1. En-tête (padding 16/16/14) : surtitre `PREMIER ENTRAÎNEMENT` (12 sp, majuscules, muted) + pastille de solde alignée à droite ; titre `Crée ton premier entraînement` (Manrope 700, 22/26) ; sous-titre `Trois façons de commencer.` (14, muted).
2. Trois rangées de chemins, ordre fixe Manuel, IA simple, Atelier IA (ordre des exigences). Chaque rangée (hauteur min 88 dp, padding 14/16) : icône 44x44 (fond `#FFF0E8`, rayon 12), nom (16 semibold) + pastille de livrable (`Programme` / `Séance`, badge gris 24 dp), une phrase (14, muted, 2 lignes max à 100 %), ligne de coût (14 semibold), chevron.
3. Hiérarchie : aucun CTA plein dans la carte (3 rangées équivalentes) ; l'accent est porté par l'icône teintée, le mot `Gratuit` en vert et le coût en orange foncé.

### 2.3 Microcopy FR (mot pour mot)
| Élément | Texte |
|---|---|
| Surtitre | `Premier entraînement` |
| Titre | `Crée ton premier entraînement` |
| Sous-titre | `Trois façons de commencer.` |
| Manuel | nom `Manuel` · livrable `Programme` · phrase `Tu construis ton programme en 4 étapes.` · coût `Gratuit` |
| IA simple | nom `IA simple` · livrable `Séance` · phrase `L'IA prépare une séance unique en quelques secondes.` · coût `{n} crédits` (ex. `4 crédits`) |
| Atelier IA | nom `Atelier IA` · livrable `Programme` · phrase `Tu discutes, l'IA construit un programme complet.` · coût `{n} crédits par message` |
| Pastille de solde | `{n} crédits` / `1 crédit` / `0 crédit` ; indisponible : `—` |
| Quota gratuit (serveur `free_left > 0`) | IA simple `1 gratuite aujourd'hui` ; Atelier `1 message gratuit aujourd'hui` (au pluriel : `{k} messages gratuits aujourd'hui`) |
| Coût inconnu | `Consomme des crédits IA` (repli existant) |
| Épuisé, ligne de coût | `Crédits épuisés` (icône verrou) |
| Épuisé, bandeau | `Tes crédits IA sont épuisés. Le parcours manuel reste gratuit.` |
| Accessibilité carte | groupe `Crée ton premier entraînement` |

Les apostrophes sont typographiques (`'` U+2019) dans l'app. Aucun emoji, aucun tiret long.

### 2.4 Destinations (FWKO-03, 04, 05)
| Rangée | Route | Écran ouvert |
|---|---|---|
| Manuel | `/(app)/workout/program-builder` | assistant 4 étapes |
| IA simple | `/(app)/workout/ai-generate` | assistant de séance unique |
| Atelier IA | `/(app)/workout/atelier` | atelier conversationnel |
Épuisé : le tap sur IA simple / Atelier IA n'ouvre PAS l'écran, il ouvre l'écran « Crédits épuisés » existant (`showExhaustionSheet`, avec `required` = coût). Manuel ouvre toujours `program-builder`.

### 2.5 États (tous rendus)
| Id | État | Rendu | Notes |
|---|---|---|---|
| H01 | Défaut, crédits disponibles | 3 rangées, solde en pastille orange clair | avec contenu |
| H02 | Crédits épuisés (solde < coût ET aucun quota gratuit) | pastille solde ambre `0 crédit` ; bandeau ambre ; Manuel en rangée mise en avant (fond `#FFF0E8`) ; rangées IA : icône grise, ligne `Crédits épuisés` avec verrou ambre (`#8A5700`) | l'état n'est pas porté par la couleur seule : mot + icône |
| H03 | Chargement | squelettes (`#ECEAE4` / `#F4F3EE`, balayage 1,5 s), `aria-busy` | affiché seulement si la lecture dépasse 400 ms ; avant, rien (évite le clignotement pour les comptes existants) |
| H04 | Disparue | l'accueil montre salutation, Mission, Quêtes | sans contenu |
| H05 | Appui / focus | appui : fond `#F0EFE9` sans changer les bornes, 100 ms ; focus : anneau 3 dp `#FF5C1A` à 33 % | |
| H06 | Texte 130 % | libellés replient, aucune coupure, titre sur 2 lignes | |
| H07 | Solde / coût indisponible | pastille `—`, coût `Consomme des crédits IA` | jamais un chiffre inventé ; ne bloque pas l'ouverture |
| H08 | Quota gratuit restant | coût remplacé par `1 gratuite aujourd'hui` / `1 message gratuit aujourd'hui` en vert | nouveau compte probable |
Erreur de lecture du programme ou des séances : voir R4 (carte masquée, pas d'écran d'erreur dédié : l'accueil gère déjà ses erreurs).

## 3. Mouvement
Tokens v1.20 : entrée 200 ms `cubic-bezier(.25,1,.5,1)` ; appui 100 ms ; squelette 1,5 s ; seuls `transform` et `opacity` s'animent.
- Apparition de la carte : fondu + translation Y 8 dp, 200 ms, une seule fois par montage (pas à chaque retour sur l'accueil).
- Disparition : fondu 150 ms ; la hauteur se replie sans animer `height` (la liste se re-met en page à la fin du fondu).
- Appui d'une rangée : fond `#F0EFE9`, pas de mise à l'échelle (les rangées bordent le bord de la carte).
- **Reduced motion** (`AccessibilityInfo.isReduceMotionEnabled`) : pas de translation, fondu 100 ms ou apparition directe ; squelette fixe `#ECEAE4`.

## 4. Onglet Entraînement, état vide (CLAR-01)
### 4.1 Écran (T01)
Remplace le contenu de l'état « Aucun programme actif » (`workout/index.tsx` l.855-905). En-tête inchangé (Entraînement, calendrier, +).
| Élément | Texte / comportement |
|---|---|
| Titre | `Aucun programme actif` |
| Texte | `Un programme organise tes séances sur plusieurs semaines. Tu préfères une seule séance ? Lance-la avec l'IA.` |
| Bouton principal (plein) | `Créer un programme` (icône `add`) → ouvre la feuille de choix (4.2) |
| Bouton secondaire (contour) | `Générer une séance IA` + pastille `4 crédits` (icône `sparkles-outline`) → `/(app)/workout/ai-generate` |
| Lien | `Mes programmes` → liste des programmes (inchangé) |
Règle de libellé : tout bouton dit son livrable. `Créer un programme` ne mène jamais à `ai-generate`.
### 4.2 Feuille « Créer un programme » (T02)
Feuille basse (modèle A02 de v1.20 lot A, rayon haut 24, poignée, scrim `rgba(28,26,23,.45)`, rôle `modal`, focus piégé, Annuler visible). Deux rangées : `Assistant en 4 étapes` (`Objectif, durée, jours, exercices. Environ 2 minutes.` · `Gratuit` · `program-builder`) et `Atelier IA` (`Discute avec l'IA pour un programme très précis.` · `{n} crédits par message` · `atelier`). Titre `Créer un programme`, sous-titre `Plusieurs séances organisées sur des semaines.`
### 4.3 Crédits épuisés (T03, T04)
Le bouton secondaire devient `Séance IA, crédits épuisés` (icône verrou) avec le texte `Reviens demain ou gagne des crédits en restant actif.` (ambre, 14) ; il reste tapable et ouvre « Crédits épuisés ». Dans la feuille, la rangée Atelier porte `Crédits épuisés` et ouvre la même feuille d'épuisement ; l'Assistant reste ouvert. Le bouton principal ne change jamais.
### 4.4 Bouton « + » de l'en-tête
Libellé accessible `Créer un entraînement`. Il ouvre une feuille à deux groupes : `Programme` (Assistant en 4 étapes, Atelier IA) et `Séance seule` (`Générer une séance IA`). Il ne mène plus directement à `ai-generate`. (Non maquetté : réutilise T02 avec un 3e choix ; à valider au plan.)

## 5. Fin d'onboarding, step-7 (CLAR-02)
Principe : n'annoncer que ce qui existe (profil enregistré, discussion avec Ziko). L'écran est clair (thème clair uniquement ; l'existant est sombre, voir Q3). Supprimer : `Ton plan est prêt`, `Première séance demain matin`, la carte `Ton programme / Push Pull Legs / 8 semaines`, l'étape de chargement `Construction de ton programme`, `Sélection des exercices adaptés`, `Calcul de tes besoins caloriques`, `Calibration du coach IA`, la flèche texte `→` (remplacée par l'icône `arrow-forward`).
### 5.1 Chargement (O01)
Titre `On prépare ton profil, {objectif court}…` ; 4 étapes : `Enregistrement de ton objectif`, `Réglage de ton niveau et de ton rythme`, `Choix de ton matériel`, `Préparation de Ziko`. Rythme existant (700 ms par étape). Reduced motion : pastille « en cours » fixe, sans clignotement.
### 5.2 Écran final : 3 variantes (sélection : Q1)
| Id | Titre | Sous-titre | Carte | Bouton |
|---|---|---|---|---|
| A (O02) | `Ton profil est prêt.` | `Ziko va te poser quelques questions pour choisir ta première mission. Ton premier entraînement, tu le crées ensuite depuis l'accueil.` | « Ce qu'on a retenu » : Objectif, Rythme (`{n} séances par semaine`), Niveau, Matériel | `Discuter avec Ziko` |
| B (O03), recommandée | `C'est noté.` | `Objectif : {objectif}, {n} séances par semaine. Voici ce qui vient.` | « La suite » : 1 `Une courte discussion avec Ziko`, 2 `Ta première mission, sur l'accueil`, 3 `Ton premier entraînement` (`Manuel, séance IA ou atelier IA, à toi de choisir`) | `Continuer` |
| C (O04) | `Bienvenue sur Ziko.` | `Ton profil est enregistré. Ziko te pose quelques questions, puis tu choisis comment créer ton premier entraînement.` | aucune | `Parler à Ziko` |
Pourquoi B : elle prépare exactement le parcours que la carte de l'accueil prend en charge (étape 3) sans rien promettre de daté ni de créé. La destination du bouton reste `ziko-chat` (inchangée) ; la sauvegarde du profil (`handleFinish`) est inchangée. Les valeurs `{objectif}`, `{n}` viennent de `obState` (déjà utilisées par `goalLabel`).
Pas de nombre de questions ni de durée annoncés (non prouvés).

## 6. Accessibilité
| Élément | Étiquette / rôle |
|---|---|
| Carte | `accessibilityRole="none"` sur le conteneur, groupe nommé `Crée ton premier entraînement` ; ordre de lecture = ordre visuel |
| Rangée Manuel | role `button`, label `Manuel, programme. Tu construis ton programme en 4 étapes. Gratuit.` |
| Rangée IA simple | `IA simple, séance. L'IA prépare une séance unique en quelques secondes. 4 crédits.` ; épuisé : `... Crédits épuisés. Ouvre l'explication.` |
| Rangée Atelier IA | `Atelier IA, programme. Tu discutes, l'IA construit un programme complet. 4 crédits par message.` |
| Pastille de solde | `Solde : 6 crédits` |
| Squelette | `aria-busy` / `accessibilityState={{busy:true}}`, label `Chargement de ton premier entraînement` |
| Bouton « + » Entraînement | `Créer un entraînement` |
| Feuille de choix | role `modal`, focus piégé, scrim ferme, bouton Annuler |
| Annonce de disparition | aucune annonce (la carte disparaît d'elle-même) ; le focus passe à l'élément suivant |
L'état « épuisé » est porté par un mot et une icône, jamais par la couleur seule. Tailles de texte jusqu'à 130 % sans coupure d'action (H06).

## 7. Critères d'acceptation mesurables
Mesures sur l'émulateur Android (capture 1080x2400 / dpi 420 ≈ 390x857 dp), arbre d'accessibilité `uiautomator`, plus les mocks rendus (`frames.json` : 0 cible < 44 dp, 0 texte < 12 sp sur 16 écrans).
| Id | Critère | Mesure |
|---|---|---|
| P2-1 | Compte sans programme ni séance : le titre `Crée ton premier entraînement` est le premier nœud de contenu sous la salutation et ses 3 rangées sont visibles sans défilement sur 390x844 (les 3 pastilles de coût incluses) | capture accueil, comparer à H01 ; bounds du nœud |
| P2-2 | Ordre vertical : y(carte P2) < y(Mission du jour) < y(Quêtes) | bounds des 3 blocs |
| P2-3 | Chaque rangée a une phrase, une pastille de livrable et une ligne de coût ; les 2 rangées IA affichent un coût en crédits (ou le repli `Consomme des crédits IA`) ; Manuel affiche `Gratuit` | lecture des textes |
| P2-4 | Taps : Manuel ouvre `program-builder` (indicateur `Étape 1/4`), IA simple ouvre `ai-generate`, Atelier ouvre `atelier` | 3 captures d'arrivée |
| P2-5 | Le coût affiché égale le coût serveur (`info.cost`) ; aucun nombre de crédits n'existe en dur dans le composant | revue de code + valeur de test 3 ≠ 4 |
| P2-6 | Après création d'un programme actif OU fin d'une séance, retour sur l'accueil : 0 nœud `Crée ton premier entraînement`, sans relancer l'app | capture avant/après |
| P2-7 | Mission du jour (hydratation) et la carte sont visibles ensemble ; la variante vide `Aucun programme actif` de la Mission est absente quand la carte est visible (R5) | arbre d'accessibilité |
| P2-8 | Solde 0 et aucun quota gratuit : chaque rangée IA contient le mot `Crédits épuisés` AVANT tout tap ; Manuel n'en contient pas ; un tap IA ouvre l'écran d'épuisement, pas `ai-generate` | solde simulé à 0 ; capture avant et après tap |
| P2-9 | Lecture en erreur (réseau coupé au démarrage) : la carte n'apparaît pas ; aucune carte « vide » n'est affichée | mode avion |
| P2-10 | Pas de clignotement : pour un compte avec programme actif, 0 image contenant la carte ou son squelette si la lecture < 400 ms | enregistrement vidéo / captures à 100 ms |
| P2-11 | Onglet Entraînement vide : le bouton principal est `Créer un programme` et ouvre la feuille de choix (2 rangées) ; le bouton `Générer une séance IA` ouvre `ai-generate` ; aucun bouton nommé `programme` n'ouvre `ai-generate` | arbre + captures |
| P2-12 | Bouton « + » : libellé accessible `Créer un entraînement` présent | uiautomator `content-desc` |
| P2-13 | Step-7 : aucune des chaînes interdites (section 5) n'apparaît ; le bouton mène à `ziko-chat` ; le profil est bien enregistré (`onboarding_done = true`) | recherche de texte dans l'arbre + requête de profil |
| P2-14 | Texte système à 130 % : aucun libellé de rangée n'est coupé (pas de `…`) ; cibles >= 44x44 dp (G1) | capture avec échelle de police 1,3 |
| P2-15 | Contrastes : texte >= 4,5:1, icônes >= 3:1 (valeurs calculées : muted 5,08 sur fond, coût `#B53D05` 5,78, `Gratuit` `#17703D` 6,14, ambre `#8A5700` 6,10) ; exception connue : blanc sur `#FF5C1A` = 3,09:1 (décision v1.20 Q1) | `shared/contrast.mjs` |
| P2-16 | Reduced motion activé : 0 translation, apparition en fondu <= 100 ms ou directe ; squelette fixe | réglage émulateur + capture à 2 instants |
| P2-17 | Aucun emoji, aucun libellé anglais, aucun `Alert` natif (`showAlert` seulement) ; `paddingBottom: 100` conservé sur les racines | regex sur les libellés rendus ; revue |
| P2-18 | Conformité à la maquette : marges 16 dp, rayon 16, écarts <= 4 dp / 2 sp (G8) | superposition capture / PNG |

## 8. Table exigence, écran, contrôle
| Exigence | Écran(s) | Contrôle |
|---|---|---|
| FWKO-01 | H01, H04 | P2-1, P2-2 |
| FWKO-02 | H01, H02, H07, H08 | P2-3, P2-5 |
| FWKO-03 | H01 (Manuel) | P2-4 |
| FWKO-04 | H01 (IA simple) | P2-4 |
| FWKO-05 | H01 (Atelier IA) | P2-4 |
| FWKO-06 | H04, H01 | P2-6, P2-7, P2-10 |
| FWKO-07 | H02, H07, T03, T04 | P2-8, P2-9 |
| CLAR-01 | T01, T02, T03, T04 (+ bouton +) | P2-11, P2-12 |
| CLAR-02 | O01, O02, O03, O04 | P2-13 |

## 9. Points à vérifier au plan (dépendances techniques, non décisions produit)
1. Comptage des séances terminées côté accueil : une requête légère (par exemple `count` sur les séances avec `ended_at` non nul) est à ajouter à `useHomeData` ou à un hook dédié ; la colonne exacte est à confirmer.
2. Coût et quota gratuit de la génération « programme » : l'atelier les lit déjà (`info`), pas encore ce chemin. Confirmer qu'une source client existe (ou en ajouter une, sans migration) pour la carte ; à défaut, repli `Consomme des crédits IA`.
3. La carte et la phase 1 modifient toutes deux `(app)/index.tsx` ; la maquette de la phase 1 (bloc Quêtes) doit rester compatible avec l'espacement 12 dp entre blocs.
4. Corriger le texte de `programs.tsx` (« Objectif, niveau, jours, matériel »), qui diffère des 4 étapes réelles.

> Correction (audit phase 2) : la maquette H08 disait « ce mois-ci » ; c'est faux. Le quota gratuit de l'IA simple est QUOTIDIEN (`creditCheck('chat')`, `/ai/session/generate`), le libelle correct est « aujourd'hui ». Le quota mensuel ne concerne que `/programs/generate`, hors carte.
