# Phase 26 : Factions & Ligues - UI-SPEC (contrat mesurable)

Pas de maquette HTML (RAM partagee avec l'emulateur ; ecrans = extensions du plugin `community`). Ce fichier est le contrat : chaque ligne est verifiable (test de rendu, lecture de code ou UAT emulateur). Charte : theme clair, tokens `useThemeStore`, styles inline, Ionicons (aucun emoji), `showAlert`, racine `paddingBottom: 100`, cartes rayon 16 + bord 1 px `theme.border` + ombre `#1C1A17` 0.08/12/elevation 3, boutons pleins `getActionPrimary(theme)` + texte blanc, FR en dur.

## Surfaces
1. **Carte d'entree "Ligue"** en tete de l'onglet `Fil` de `CommunityPlugin` (`LeagueEntryCard`).
2. **Ecran `LeagueScreen`** (route `/(plugins)/community/league`, titre `Ligue`).
3. **Modale de celebration** (une fois par transition).
4. **Bloc "Defi de groupe"** dans `LeagueScreen` (liste + detail repliable).

## Criteres mesurables

### Carte d'entree (LG-ENT)
- E1 : hauteur >= 64 dp ; zone tactile unique = toute la carte (>= 44 dp) ; role accessibilite `button`, libelle `Ouvrir la Ligue`.
- E2 : icone `trophy` (Ionicons) 24 dp dans un rond 44 dp teinte `primary + '18'`.
- E3 : sous-titre selon l'etat : verrouille `Se debloque au niveau 3` ; sans faction `Choisis ta faction` ; sinon `<Faction> · <Palier>` ; celebration en attente : puce `Nouveau` (texte blanc sur `actionPrimary`).
- E4 : aucune mention de score chiffre, aucun rang, aucun nom d'une autre personne.

### Ecran (LG-SCR)
- S1 : en-tete `Ligue` + sous-titre `Ta regularite, a ton rythme`. Aucun mot de la liste interdite : `perdu, chute, relegation, descente, echec, elimine, dernier` (test de copie sur toutes les chaines de la surface).
- S2 : etats : chargement (3 squelettes de carte hauteur 96 dp, pas de spinner plein ecran), erreur reseau (carte `Impossible de charger la Ligue` + bouton `Reessayer` plein), verrouille (carte `Ligue verrouillee` : icone `lock-closed`, texte `Elle s'ouvre au niveau 3. Continue a ton rythme.`, AUCUN compteur ni barre de progression), contenu.
- S3 : ordre des cartes (contenu) : Faction -> Piste & palier -> Cette semaine -> Defis de groupe.
- S4 : **Faction** : si aucune, grille 2 colonnes de 6 tuiles (icone + libelle, hauteur >= 72 dp, la suggeree porte le tag `Suggeree`), tap -> `showAlert` de confirmation (`Rejoindre <Faction> ?`, 2 boutons `Annuler` / `Rejoindre`). Si deja membre : une ligne icone + libelle + `Changer` (bouton texte) ; si delai < 30 j : le bouton ouvre `showAlert` `Tu pourras changer le <jj/mm>` (pas de blocage muet).
- S5 : compteur de faction : affiche `<n> membres` uniquement si l'API renvoie un entier (>= 10 adultes), sinon rien (pas de `0`, pas de `--`).
- S6 : **Piste & palier** : libelle de piste (`Piste Habitudes` / `Piste Performance`), nom du palier (Bronze..Diamant) + 5 points de progression (rempli jusqu'au palier courant, 10 dp), texte d'aide `Ton palier monte avec ta regularite et ne descend jamais de plus d'un cran par rapport a ton meilleur.` Jamais de score d'une autre personne.
- S7 : **Cette semaine** : barre de progression 8 dp (fond `theme.border`, remplissage `primary`) pour la semaine EN COURS (calcul provisoire), libelle `Cette semaine : X sur Y` (unite : `seances` / `habitudes`), pas de pourcentage rouge ; en dessous 4 pastilles des semaines cloturees (icone `checkmark-circle` si score >= 80, `ellipse` sinon, sans couleur d'alerte ; couleur `muted` pour les semaines basses).
- S8 : les deux pistes ne sont jamais affichees cote a cote ni comparees ; l'historique d'une ancienne piste est une ligne `Historique Habitudes : N semaines` (texte `muted`).
- S9 : **Defis de groupe** : carte par defi actif : titre, `Groupe : <total> / <cible> <unite>`, barre 8 dp, `<n> participants`, ligne `Ma contribution : <m>` (si participant). Aucune liste de personnes. Etat invite : 2 boutons `Rejoindre` (plein) et `Pas cette fois` (contour) ; etat accepte : lien texte `Quitter ce defi`. Sans defi : `Aucun defi de groupe pour l'instant` + icone `people-outline`.
- S10 : toute action sensible passe par `showAlert` (jamais `Alert`) ; aucun appel a `Alert.alert`.
- S11 : zones tactiles >= 44 x 44 dp ; contraste texte/fond >= 4.5:1 (boutons : `getActionPrimary` + blanc) ; aucun texte < 12 sp ; `paddingBottom: 100`.
- S12 : tirer pour rafraichir (RefreshControl) relance `ziko_league_sync` + `POST /league/refresh`.

### Celebration (LG-CEL)
- C1 : declenchee a l'ouverture de `LeagueScreen` si une transition a `celebrated_at` NULL ; une seule fois (apres `Continuer`, RPC d'acquittement ; echec reseau : la modale se re-affiche, pas de perte).
- C2 : contenu : icone `ribbon` 56 dp, titre `Nouvelle piste : Performance`, texte `Ziko a vu ta regularite. Tu passes en piste Performance. Ta piste Habitudes reste dans ton historique.`, raison de l'IA en citation (<= 300 car., 4 lignes max), bouton `Continuer` plein `getActionPrimary`.
- C3 : pas de bouton `Refuser`/`Annuler` (decision IA seule, SEED) ; la modale ne bloque rien d'autre : `Continuer` est toujours actif.
- C4 : animation <= 250 ms, desactivee si `reduce motion`.

## Etats vides / erreurs / limites
- Aucune faction + deblocage atteint : section Faction seule visible en tete (S4), le reste affiche `Choisis une faction pour commencer`.
- Reseau coupe apres chargement : bandeau `Hors ligne : derniere mise a jour <heure>` ; actions (rejoindre, accepter) echouent avec bandeau `Action non enregistree` + `Reessayer` (jamais silencieux).
- Mineur / age inconnu : meme ecran ; seul changement = le compteur de faction n'est jamais affiche (S5) ; aucun autre ecran ne liste des personnes.

## Hors contrat (differe)
Classement, saisons, cosmetiques, pastille sur le profil public, creation de defi cote coach (web), notification push.
