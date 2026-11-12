# Convention de migrations v1.20 (HARN-07)

Nom : `supabase/migrations/20261201PPSS_description.sql`

- `PP` = numero de la phase du milestone v1.20 sur 2 chiffres (01-26)
- `SS` = sequence dans la phase, 01 a 09
- `description` = snake_case minuscule, `[a-z0-9_]`

Exemple : phase 12, 1ere migration = `20261201` + `12` + `01` = `202612011201_rewards_achievements.sql`.

Raisons : la version max hebergee est `20261111135505`, donc tout `20261201*` est strictement posterieur (ordre d'application garanti) ; chaque phase a son bloc de 9 -> aucune collision entre worktrees paralleles.

Regles : jamais d'edition d'une migration existante (toujours un nouveau fichier) ; migrations appliquees uniquement par l'orchestrateur apres approbation ; tables prefixees `ziko_`.

Verification : `node scripts/uat/check-migration-names.mjs [baseRef]` (format, unicite PPSS, aucune migration existante modifiee/supprimee depuis `baseRef`, defaut `milestone/v1.20`).
