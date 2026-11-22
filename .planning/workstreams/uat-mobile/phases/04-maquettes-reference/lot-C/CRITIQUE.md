# Critique et audit des lots C et D (sur ma propre sortie)

Méthode : skills `critique` et `audit` exécutés pour de vrai. Détecteur déterministe `npx impeccable --json` sur les 6 pages HTML (63 constats bruts, triés ci-dessous) ; audit mesuré par Playwright (couleurs calculées, emoji, tailles) en plus de `shared/build.mjs` (cibles < 44 dp, polices < 12 sp) et `shared/contrast.mjs` ; revue heuristique de Nielsen par écran. Écrans : 30 (lot C) + 14 (lot D) = 44. `frames.json` : 0 cible tactile < 44 dp, 0 police < 12 sp sur 44 écrans.

## Scores
Nielsen (heuristiques) : **33/40**. Visibilité de l'état 3 (toasts, badges de source, `Envoyée`), correspondance monde réel 4 (vocabulaire FR, objectifs en clair), contrôle 3 (annuler une demande, confirmation de suppression), cohérence 3 (une écart d'orange assumé, voir Q1), prévention d'erreur 3 (durée > 16 h, suppression confirmée), reconnaissance 4, efficacité 3 (steppers longs à parcourir pour 54 min : voir minor 1), minimalisme 3, récupération d'erreur 3 (D04, D14), aide 3 (états vides actionnables). Audit technique : **17/20** (accessibilité 3, performance 4 : n'anime que `transform`/`opacity`, adaptation 3, thème 4 : tokens uniquement, anti-patrons 3).

## Verdict anti-patrons (est-ce du "fait par IA" ?)
Non pour l'essentiel : charte imposée (clair, orange, Ionicons), typographie Manrope + Geist déjà choisie au lot A, pas de dégradé de texte, pas de verre dépoli, pas de bordure latérale colorée, pas de métrique héroïque (les chiffres du Suivi/profil sont des données réelles, pas un gabarit). Risques relevés : (1) listes en cartes de lignes très semblables sur D01/D05/C13 : acceptées car c'est de la donnée tabulaire, mais la carte `Réveil articulaire` (bordure primaire) et le badge de source donnent la hiérarchie ; (2) le détecteur signale `Geist` et un fond "crème" : le fond `#F7F6F3` et Geist viennent de la charte et du lot A, donc assumés ; (3) à ne pas ajouter à l'implémentation : confettis/animation de victoire sur les cases cochées.

## Détecteur : tri des 63 constats
- **Faux positifs ou exemptés (61)** : `low-contrast` blanc sur `#ff5c1a` (x 8 pages) et `#ff5c1a` sur blanc : le détecteur lit la valeur par défaut de `tokens.css` sans appliquer la surcharge `--primary:#CF4509` des lots C/D. Preuve : Playwright, 0 élément dont la couleur ou le fond calculé vaut `rgb(255,92,26)` sur les 6 pages. `low-contrast` `#6b6963` sur `#e9e7e1` : fond de la page d'aperçu (hors téléphone), pas du produit. `cramped-padding` sur `tabs`, `seg`, `stp` (30) : contrôles segmentés dont les cellules touchent le bord par construction (hauteur 44, rayon). `overused-font` / `cream-palette` : voir verdict.
- **Réels et corrigés (2)** : jours du mois précédent du calendrier `#A9A69E` sur blanc = 2,4:1 : passés en `#6B6963` (5,4:1) ; `#8A877F` sur `#F0EFE9` (3,1:1) reste uniquement sur boutons **désactivés** et icônes verrouillées (exemptés de WCAG 1.4.3, doublés d'un libellé).
- **Mesures propres** : 0 emoji (`\p{Extended_Pictographic}`) ; textes < 14 sp = uniquement les exceptions 12 sp listées au contrat.

## Corrigé après critique
- C05 : en-tête annonçait 5 exercices pour 3 lignes : 5 lignes. C22 : durée totale fausse (41 min 30) recalculée par la formule : **54 min**. C06 : 3 séances / 2 jours de série incohérents avec le calendrier : aujourd'hui sans séance, 2 séances, 17 min, série 2 j, dernière = hier. Calendrier complet du mois (30 jours).
- Interrupteur de 32 dp de haut : zone tactile 52x44 (`swh`), mesure G1 à 0 échec.
- D02 : `Demande envoyée` passait le nom sur 2 lignes : `Envoyée` en liste (étiquette complète en accessibilité), `Demande envoyée` conservé sur le profil et dans le toast.
- Badge de l'onglet En attente : 3 (reçues + envoyées) -> 2 (reçues, l'action attendue).
- C14 : compteurs `(11)` en 12 sp hors exceptions : 14 sp. C16 : texte "plusieurs moments" contredisait un segment à choix unique : puces multi-choix.
- Profil : avatar rogné par la bannière (bug UAT SOC-07) : chevauchement de 44 dp avec avatar au-dessus et bouton hors recouvrement.

## Points assumés
- Marques, marchands, prix, personnes : inventés et marqués placeholders ; aucun visuel produit (tuile `Visuel` en pointillés). Pas de photo de profil.
- Couleurs des phases du sommeil (bleu profond, bleu clair, vert REM) : seules couleurs hors charte du lot, uniquement dans un graphique doublé d'une liste chiffrée ; pas de mode sombre.
- Les écrans défilants sont coupés comme au lot A (D08 à D10 forment un seul profil en 3 vues).
- Mineur 1 (non traité) : 54 min = 11 appuis sur un stepper ; l'appui long accélère (contrat §4). Alternative : saisie numérique en feuille, à arbitrer en phase 20.

## Questions ouvertes (5)
1. **Orange d'action** : adopter `#CF4509` (blanc 4,66:1) pour tout le produit, y compris A/B (recommandé, un token) ; ou garder `#FF5C1A` + libellé `#1C1A17` (5,62:1, boutons à texte noir) ; ou accepter l'exception 3,09:1 de la charte. Les lots C/D sont rendus avec `#CF4509`.
2. **Couleur du module Journal (D-04b, hors lots C/D, proposée ici)** : le violet est à remplacer. Option A sarcelle `#0F766E` (blanc dessus 5,47:1, 5,06:1 sur fond) ; option B bleu ardoise `#3F5F8A` (6,53:1 / 6,04:1). Recommandation : A, qui reste distincte de l'info `#2563C9` (hydratation/sommeil) et de l'orange. À valider avant la phase 22.
3. **Rappels des compléments** : un rappel par créneau listant les produits (maquette, recommandé : 3 notifications max par jour) ou un rappel par produit (plus fin, plus bruyant) ?
4. **Sommeil, source connectée contre saisie** : masquer la saisie manuelle de la même nuit (maquette) ou l'afficher repliée avec `Utiliser ma saisie` ? Recommandation : masquer, conserver en base.
5. **Liens du comparateur** : afficher la mention `Lien partenaire` si des liens d'affiliation sont ajoutés plus tard (obligation de transparence) ; aujourd'hui aucune mention dans les maquettes car aucun lien affilié n'est prévu : à confirmer.
