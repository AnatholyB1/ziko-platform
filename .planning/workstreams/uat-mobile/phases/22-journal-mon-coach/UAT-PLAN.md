# UAT-PLAN Phase 22 : Journal et Mon coach (emulateur, en file apres P1)

Compte : athlete de test HARN-03 (lie a un coach). Emulateur Android 1080x2400 / dpi 420. Verrou machine `.planning/.machine-lock` avant usage. Aucun appel externe ; ecritures uniquement sur le compte de test (base de test/harnais, jamais la prod).

## Preparation
1. Build dev du worktree/branche `phase/22-journal-coach` (ou milestone apres merge), connexion du compte HARN-03.
2. Base : `select id, mood, energy, stress, context, date from ziko_journal_entries where user_id = <athlete> and date = <aujourd'hui local>` ouverte pour verification apres chaque scenario.

## Scenarios
| Id | Scenario | Attendu | Preuve |
|---|---|---|---|
| JR-1 | Modules > Journal > Aujourd'hui, puis Historique, puis ecran `journal/entry` | 5 tuiles d'humeur en Ionicons (`sad-outline`, `sad`, `remove-circle`, `happy`, `happy-outline`) + libelles Mauvais/Bof/Moyen/Bien/Super ; energie `battery-half`, stress `pulse`, moments `sunny/barbell/fitness/moon/ellipse` ; 0 emoji | capture + `uiautomator dump` |
| JR-2 | Enregistrer, mettre l'app en arriere-plan > 5 min (ou forcer l'expiration du jeton), revenir, enregistrer | Succes `Entree enregistree`, 0 alerte `Utilisateur non connecte`, ligne creee | capture + requete base |
| JR-3 | Enregistrer successivement les 5 moments | `context` = morning / pre_workout / post_workout / evening / general, 0 erreur | requete base |
| JR-4 | Accueil : noter l'humeur (Quick Log), puis Journal moment `General` | Bandeau `Humeur deja notee ... Bien`, bouton `Mettre a jour`, 1 seule ligne `general` ce jour apres enregistrement | capture + base |
| JR-5 | Inspecter selection / onglets / barres | Selection : bord sarcelle 2 dp, fond `#E1F1EF` ; bouton plein orange `#CF4509` ; aucun violet | capture + pixel |
| JR-6 | Invalider la session (revoquer le refresh token cote harnais), saisir humeur/energie/stress/note, Enregistrer | Bandeau `Session expiree`, saisie conservee ; `Se reconnecter` mene a la connexion ; apres reconnexion, retour au Journal : saisie intacte, `Reessayer` enregistre | capture + base |
| JR-7 | Historique avec des entrees sur 2-3 jours seulement | Jour sans entree = pas de barre ; hauteur = moyenne du jour ; `x,y / 5` + ecart semaine passee | capture |
| JR-8 | Mode avion puis Enregistrer | `Pas de connexion`, `Reessayer` ; reseau rendu, Reessayer reussit | capture |
| CO-1 | Modules > Mon coach (coach lie) | Nom du coach, specialites, badge `IDENTITE VERIFIEE` si KYC verifie, `Ton coach depuis le ...`, 2 stats | capture |
| CO-1b | Idem avec un lien sans profil (retirer le profil/kyc cote coach ou intercepter `/coach/clients/links/me` sans `preview`) | Carte `Ton coach`, badge `COACH LIE`, bandeau `Profil indisponible`, stats visibles ; jamais vide | capture |
| CO-2 | En-tete | `PluginHeader` (titre 20 sp, chevron), 0 titre de 28 px ; zone de retour >= 44x44 (suivi P5/XCUT) | `uiautomator` |
| CO-3 | Coach non verifie | Pas de badge ; specialites = celles du profil | capture |
| CO-4 | Profil degrade, couper puis retablir le reseau, `Reessayer` | La carte complete remplace la carte degradee sans quitter l'ecran | capture |
| CO-5 | Coupure reseau complete a l'ouverture | Carte d'erreur `Impossible de charger` + `Reessayer`, jamais ecran vide | capture |

## Hors perimetre / suivi
- Retrait du coach, programme prescrit, flux d'invitation : P25 (le bouton existant `Retirer ce coach` est conserve tel quel dans le pied de carte).
- Zone tactile du chevron (34 dp) : composant `PluginHeader`, traite par P5/XCUT.
