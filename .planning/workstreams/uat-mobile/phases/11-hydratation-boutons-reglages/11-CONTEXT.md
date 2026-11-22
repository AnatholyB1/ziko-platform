# Phase 11: Hydratation : boutons et reglages - Context

**Gathered:** 2026-11-12 (recap chantier 6). Req : HYDR-01..06. Vague 1. UI hint oui, UI-SPEC propre (hors liste DSGN).

## Decisions verrouillees
- **D-01** HYDR-01 : boutons +250/+500/+750 redessines (l'aspect actuel est juge laid) : design par le contrat (carte standard, Ionicons goutte, etat presse, retour haptique leger) ; ajoutent la bonne quantite.
- **D-02** Reglages : les 4 lignes aujourd'hui non cliquables deviennent **editables et persistees** : (HYDR-02) Rappels on/off + intervalle + plage horaire ; (HYDR-03) taille de verre par defaut ; (HYDR-04) cafe/the on/off + pourcentage compte ; (HYDR-05) bonus jour de seance (ml).
- **D-03** Persistance en base (table de reglages d'hydratation, migration bloc `20261201 1101-1109`, RLS `auth.uid() = user_id`, prefixe `ziko_`) ; les rappels reutilisent le systeme de notifications existant (`notificationStore`, `workout_reminder_prefs` comme modele) sans envoyer de push reel en test.
- **D-04** HYDR-06 : le champ de l'objectif reste visible au-dessus du clavier (`KeyboardAvoidingView` + scroll au focus, verifie a l'emulateur avec clavier ouvert).
- **D-05** L'objectif quotidien reste calcule/edite comme aujourd'hui ; le bonus jour de seance s'ajoute quand une seance est loguee ce jour-la (definir la detection dans le plan).
- **D-06** Fichiers : `plugins/hydration/**`, `backend/api/src/tools/hydration.ts` (outil IA existant : mettre a jour si les reglages le concernent), migration. Rien d'autre. Total d'eau de la tuile accueil = P8 (ne pas toucher).

## Zones grises restantes
UI-SPEC a produire (agent design wave-1 contracts). Recommandation pour le design : une feuille de reglages en liste de lignes cliquables ouvrant un selecteur/feuille basse, pas des champs inline.
