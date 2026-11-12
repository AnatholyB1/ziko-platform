# UAT-PLAN Phase 2 : session & authentification (a executer par l'orchestrateur apres P1)

Pre-requis : build dev mobile de la branche `phase/02-session-auth-robustes`, compte de test connecte, emulateur Android (verrou machine), `adb` disponible. Captures dans le dossier de preuves P1.

## U1 - Arriere-plan prolonge puis retour (SESS-01, SC1)
1. Connecte, ouvrir l'accueil. `adb shell input keyevent KEYCODE_HOME`.
2. Prolonger : soit attendre > duree de vie du JWT (defaut Supabase 1 h ; si parametre plus court sur le projet de test, l'utiliser), soit avancer l'horloge : `adb shell settings put global auto_time 0` puis `adb shell date` / `cmd alarm` (ou `adb shell su 0 date -s ...` si emulateur rootable), attendre 10 s.
3. Revenir : `adb shell monkey -p <package> 1` (ou Maestro `launchApp` sans `clearState`).
4. Verifier (capture) : pas de redirection login, puis 3 actions reussissent : enregistrer une entree Journal, ajouter un log (eau/humeur), envoyer une demande d'ami depuis la recherche globale. Aucune alerte "Utilisateur non connecte".
5. Logcat : `adb logcat -d | grep -i "refresh"` : une requete `token?grant_type=refresh_token` au retour.

## U2 - Session expiree simulee (SESS-02, SC2)
Methode A (preferee) : supprimer le refresh token cote serveur du compte de TEST (jamais le compte reel) via `signOut` global depuis un autre client, puis forcer l'expiration de l'access token comme en U1.
Methode B : `adb shell run-as <package> ` effacer la cle AsyncStorage `sb-*-auth-token` de la base `RKStorage` (build debug) puis retour au premier plan.
Attendu : alerte "Session expiree", redirection `/(auth)/login` sans fermer l'app, pas de boucle (une seule alerte), reconnexion possible et l'app refonctionne.
Maestro : `launchApp` -> `assertVisible: "Session expiree"` -> `tapOn: "OK"` -> `assertVisible: <ecran login>`.

## U3 - Pas de "Utilisateur non connecte" sur session valide (SESS-03, SC3)
Sur session valide (y compris juste apres retour d'arriere-plan) : Journal enregistrer, Habitudes, Hydratation, Mesures, Communaute (poster/liker), Timer. Aucune alerte "Utilisateur non connecte"/"Non connecte"/"Not authenticated".

## U4 - Demande d'ami depuis la recherche (SESS-04, SC4)
Deux comptes de test A et B. A : recherche globale B -> bouton ajouter -> bouton passe a "Envoye". Re-cliquer apres relance du composant : pas d'erreur (23505 traite comme envoye). Cas session perimee (U1) : demande reussit apres retour. Verifier en base de TEST la ligne `ziko_friendships` (lecture seule).

## Hors-ligne
Mode avion au retour au premier plan : pas de deconnexion (statut `offline`), retour du reseau : reprise normale.
