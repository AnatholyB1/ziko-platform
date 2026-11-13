# Phase 25 : Mon coach complet - UI-SPEC (contrat sans maquette)

Pas de maquette Claude Design : ce contrat + `25-CONTEXT.md` font foi. Pas de HTML rendu (decision : extensions de `CoachScreen`/`CoachCard` P22 deja conformes a la charte ; RAM partagee avec l'emulateur). Chaque critere est mesurable (test, `uiautomator dump`, capture). Charte : fond `#F7F6F3`, surface `#FFFFFF`, bord `#E2E0DA`, texte `#1C1A17`, muted `#6B6963`, bouton plein = `getActionPrimary(theme)` (#CF4509), danger `#DC2626` (texte/bord seulement, jamais fond plein sauf confirmation), Ionicons, styles inline, `showAlert`, racines `paddingBottom: 100`, cartes rayon 16 / bord 1 px / ombre 0.08-12-elev 3, cibles >= 44 dp, texte >= 14 sp.

## Ecrans / etats (tous sous `PluginHeader` "Mon coach")

### M25-A : etat A (code) + historique
- Champ code 6 car. (inchange, `[A-Z2-9]`, collage), bouton `Valider le code` = `getActionPrimary` quand 6 car., gris sinon.
- Bloc `Anciens coachs` (affiche seulement si >= 1 lien revoque), titre 14 sp muted majuscules, repliable (chevron `chevron-down`/`chevron-up`, zone >= 44 dp), max 5 lignes : initiales/avatar 36 dp, nom (ou `Ancien coach` si profil indisponible), `du 3 oct. 2026 au 21 nov. 2026`. Aucune action destructrice, aucun bouton "supprimer l'historique".
- Critere AC-A1 : pas de bloc si 0 historique ; AC-A2 : 5 lignes max ; AC-A3 : une ligne sans nom -> `Ancien coach` (jamais vide).

### M25-B : etat B (apercu)
- Inchange sauf : bouton `Lier mon compte` = `getActionPrimary` (plus `theme.primary`), `accessibilityRole="button"`, `Annuler` zone >= 44 dp.

### M25-C : etat C (lie)
1. `CoachCard` P22 (inchange). Le pied de carte : bouton `Retirer ce coach` (texte `#DC2626`, icone `person-remove-outline`, hauteur >= 48 dp, libelle exact).
2. Carte `Programme de ton coach` (sous la carte coach, marge 16) :
   - Titre 16 sp 700 `Programme de ton coach`, puce de statut : `Actif` (vert `#16A34A` texte + icone `checkmark-circle`), `Remplace par ton programme` (muted + `swap-horizontal`), `Disponible` (muted + `time-outline`). Statut jamais porte par la couleur seule (icone + libelle).
   - Nom du programme (16 sp 700), ligne secondaire `3 seances par semaine · semaine 2/8` (champs absents omis, jamais "undefined"/"NaN").
   - Boutons : `Voir le programme` (secondaire : bord 1 px, texte `#1C1A17`, 48 dp) ; si statut != `Actif` : `Reprendre ce programme` (plein `getActionPrimary`, 48 dp).
   - Etat vide : `Ton coach n'a pas encore prescrit de programme.` + icone `clipboard-outline` (carte presente, jamais zone vide).
   - Etat chargement : squelette 2 lignes ; etat erreur : `Impossible de charger le programme` + `Reessayer` (44 dp), le reste de l'ecran reste utilisable.
3. Confirmation de reprise (statut `replaced`) : `showAlert('Remplacer "X" ?', 'Ton programme actuel sera mis en pause. Tu pourras le reprendre depuis Mes programmes.', [Annuler (cancel), Remplacer])`. Aucune activation sans confirmation.

### M25-D : modale de retrait
- Titre `Retirer ton coach ?`. Corps : `Tu ne seras plus lie a {nom}. Ton historique, tes programmes et tes donnees sont conserves. Tu pourras te relier a tout moment avec un nouveau code.` Champ `Tape COACH pour confirmer` (D-06). Boutons : `Garder mon coach` (bord, 48 dp, a gauche) et `Retirer` (texte/fond `#DC2626` seulement une fois `COACH` saisi, sinon gris `#E2E0DA`).
- Succes : ferme la modale, retour a l'etat A, `showAlert('Coach retire', 'Tu n\'es plus lie a {nom}. Ton historique est conserve.')`. Echec : `showAlert('Impossible de retirer le coach.', 'Veuillez reessayer.')`, saisie conservee.
- AC-D1 : le corps contient les mots `conservés` et `nouveau code` ; AC-D2 : `Retirer` desactive tant que la saisie != `COACH` (insensible aux espaces autour) ; AC-D3 : aucun mot punitif (`supprime`, `perdu`, `definitivement`).

### M25-E : liste du store (non-desinstallable)
- Pour un plugin `mandatory` : la corbeille/bouton `Desinstaller` est remplace par un bouton inactif icone `lock-closed-outline`, libelle `Obligatoire`, `accessibilityState={{ disabled: true }}` ; un appui affiche `showAlert('Module obligatoire', 'Mon coach fait partie de Ziko et ne peut pas etre desinstalle.')`. `uninstallPlugin('coach')` n'ecrit rien en base meme si appelee (garde dans la fonction).
- AC-E1 : 0 appel `delete` sur `ziko_user_plugins` pour un plugin mandatory (test) ; AC-E2 : le bouton hero (carte "A la une") ne propose pas `Desinstaller` pour `coach`.

## Etats transverses
Chargement lien : squelette (P22). Erreur reseau complete : carte `Impossible de charger` + `Reessayer` (P22). Session expiree : gere par la couche P2 (inchange).

## Criteres UAT (voir `UAT-PLAN.md`) : MC-1..MC-9.
