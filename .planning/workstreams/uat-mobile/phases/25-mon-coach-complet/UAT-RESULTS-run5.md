# P25 : resultats run 5 (lien coach de fixture, `ziko_coach_client_links` actif)

| Critere | Verdict | Detail |
|---|---|---|
| MC-4 Etat C avec programme assigne | PASS | "Disponible" (aucun programme actif) / "Remplace par ton programme" (un programme IA actif) / "Actif" ; "3 seances par semaine · semaine 3/8" ; "Reprendre ce programme" active sans confirmation (`is_active` vrai). Ecart plan : le statut "Remplace par ton programme" n'est pas decrit au plan. |
| MC-6 Coach sans programme | PASS | "Ton coach n'a pas encore prescrit de programme." |
| MC-11 Store : Mon coach obligatoire | FAIL partiel | Liste : bouton "Obligatoire" avec cadenas (PASS). Appui : AUCUNE alerte "Module obligatoire" (attendue). Cause probable `apps/mobile/app/(app)/store/index.tsx:405` : `accessibilityState={{ disabled: true }}` rend le `TouchableOpacity` non pressable, donc `uninstallDecision` (`:158`) n'est jamais appele. Hero card et `store/[id]` : NON-TESTE. |
| MC-13 Coupure reseau (etat C) | PASS | "Impossible de charger le programme" + "Reessayer" ; identite coach conservee, compteurs "--". Demarrage a froid hors ligne : ecran "Bienvenue" (session non restauree sans reseau) a noter hors P25. |
| MC-8 bouton mobile "Retirer ce coach" | NON-TESTE |  |
