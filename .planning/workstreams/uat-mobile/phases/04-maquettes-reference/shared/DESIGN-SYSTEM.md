# Socle commun des contrats de maquette (Phase 4, DSGN-01)

Source de verite visuelle : `shared/tokens.css` (rendu), `shared/contrast.mjs` (ratios), `shared/build.mjs` (rendu Playwright 390x844 DPR2). Theme clair uniquement. La maquette validee gagne sur toute divergence (D-06).

## 1. Tokens
| Role | Valeur | Usage |
|---|---|---|
| Fond / Surface / Bord | `#F7F6F3` / `#FFFFFF` / `#E2E0DA` | racine / cartes, feuilles / contours, separateurs |
| Surface 2 | `#F0EFE9` | segments, pistes de barre, icones verrouillees |
| Primaire | `#FF5C1A` (teinte `#FFF0E8`) | action principale, onglet actif, progression |
| Texte orange sur clair | `#B53D05` | liens et libelles orange (le primaire seul rate AA en texte) |
| Texte / Muted | `#1C1A17` / `#6B6963` | corps / secondaire |
| Succes / Alerte / Danger / Info | `#17703D` / `#8A5700` / `#B5301F` / `#2563C9` (teintes `#E6F4EC` `#FDF3DC` `#FBE9E7` `#E8F0FD`) | statuts, toujours avec un libelle ou une icone |
| Or (pieces, succes) | icone `#9A6F00`, texte `#7A5800`, teinte `#FBF1D3` | Recompenses |
Carte : rayon 16, bord 1px `#E2E0DA`, ombre `#1C1A17` @ 0.08, rayon 12, elevation 3 (RN : `shadowOpacity .08, shadowRadius 12, elevation 3`). Controles : rayon 12, hauteur 48 (boutons, champs), 44 (puces tactiles, segments). Feuille basse : rayon haut 24, poignee 40x4. Echelle d'espacement 4/8/12/16/20/24/32.
Typo : Manrope (titres 17/22/28, 700-800) + Geist (corps 15, secondaire 14, 400-600) ; surtitre 12 majuscules espacees. Si les polices ne sont pas embarquees dans l'app, repli systeme sans changer les tailles.
Icones : Ionicons (v8 outline par defaut, pleine pour l'etat actif/rempli). Jamais d'emoji. Noms utilises : voir les `data-n` dans `lot-*/src/*.html`.

## 2. Mouvement (tokens)
Entree 200-250 ms `cubic-bezier(.25,1,.5,1)` ; sortie 150 ms ease-in ; appui 100 ms (echelle .98 + fond `#F0EFE9`) ; feuille basse : translation Y 250 ms, scrim fondu 200 ms ; squelette : balayage 1,5 s `#ECEAE4`/`#F4F3EE` (jamais orange) ; curseur de flux : clignotement 1 s. On n'anime que `transform`/`opacity`. **Reduced motion** (`AccessibilityInfo.isReduceMotionEnabled`) : feuilles en fondu 100 ms sans translation, squelettes fixes `#ECEAE4`, curseur fixe, barres de progression sans animation d'entree.

## 3. Accessibilite
Roles : bouton `button`, onglets `tab` + `selected`, barres `progressbar` + `accessibilityValue {now,max}`, feuilles `modal` avec focus piege, scrim ferme la feuille. Toute icone seule a un `accessibilityLabel` francais. L'etat n'est jamais porte par la couleur seule (badge ACTIF, POSSEDE, VERROUILLE, EXPIRE DEMAIN sont des mots). Ordre de lecture = ordre visuel. Champs : label visible au-dessus, jamais le placeholder seul. Dynamic type : mise en page testee jusqu'a 130 % sans coupure de libelle d'action (les lignes se replient).

## 4. Criteres mesurables communs (verifiables sur emulateur Android, capture 1080x2400 / dpi 420 => 390x~857 dp)
- **G1** Cibles tactiles >= 44x44 dp (uiautomator `bounds` de tout element clickable). Rendu verifie : `frames.json` liste `bad` (0 attendu sur 44 écrans).
- **G2** Texte >= 14 sp ; exceptions limitees a : surtitres 12 sp majuscules, badges 12 sp, libelles de barre d'onglets 12 sp. Aucun texte < 12 sp.
- **G3** Contrastes : `node shared/contrast.mjs` (texte 4.5:1, icones 3:1). Exception connue et soumise a decision (CRITIQUE Q1) : blanc sur `#FF5C1A` = 3.09:1.
- **G4** `paddingBottom: 100` sur toute racine d'ecran scrollable : le dernier element scrolle a fond finit >= 100 dp au-dessus du bas de l'ecran.
- **G5** Safe-area haute : premier contenu >= 44 dp du haut (barre d'etat Android ~24-28 dp + marge), jamais sous la barre d'etat.
- **G6** Cartes : rayon 16 dp, bord 1 dp `#E2E0DA`, ombre RN ci-dessus ; pas de carte dans une carte.
- **G7** Aucune chaine UI ne contient d'emoji (regex Unicode `\p{Extended_Pictographic}` = 0 resultat sur les libelles rendus).
- **G8** Marges laterales d'ecran 16 dp ; ecart tolere a la maquette : +-4 dp sur marges et espacements, +-2 sp sur les tailles de texte.
- **G9** Aucun libelle anglais visible (sauf noms propres/unites) : controle de capture.
