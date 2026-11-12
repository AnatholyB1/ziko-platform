# Phase 12 : Plan d'UAT emulateur (Recompenses : Succes & Boutique)

Les UAT emulateur sont en file (apres P1). Ce plan donne des criteres mesurables, les seeds et la verification base. Prealable : les migrations `202612011201` et `202612011202` doivent etre appliquees (par l'orchestrateur, apres approbation) sur la base cible de l'UAT ; sans elles l'ecran Succes affichera la carte d'erreur B05 (la RPC `ziko_get_badge_progress` n'existe pas encore).

Compte de test : chaque scenario precise son seed. Capture = captures d'ecran emulateur + arbre d'accessibilite (`uiautomator dump`).

| Id | Seed | Etapes | Mesure (reussite) |
|---|---|---|---|
| R-1 | n'importe quel compte niveau >= 3 (plugin visible) | Ouvrir Recompenses ; toucher chaque onglet | 4 onglets exactement, ordre `Niveau, Succès, Boutique, Quêtes` ; sur CHAQUE onglet une puce `Solde : N pièces` (contentDescription) ; `N` = `ziko_user_gamification.coins` |
| R-2 | compte avec 42 seances, 6 records, serie 5, 4 succes | Onglet Succes, defiler | 11 lignes (7 `À débloquer` + 4 `Débloqués`) ; 11 icones differentes (aucun emoji) ; chaque ligne non debloquee affiche `n / N` ; compteur `4 sur 11 débloqués` |
| R-3 | compte neuf (0 succes, 0 seance) | Terminer une 1re seance valide (>= 1 serie), puis ouvrir Succes SANS relancer l'app. Repeter avec une seance vide (aucune serie) : rien de neuf | `Première séance` passe de `À débloquer` a `Débloqués` ; date = jour courant ; toast `Succès débloqué : Première séance (+25 pièces)` ; base : 1 ligne `ziko_user_badges` (`earned_at` reel) + 1 ligne `ziko_coin_transactions` source `achievement` |
| R-4 | compte R-2 | Ouvrir la fiche d'un succes debloque, puis d'un verrouille | debloque : `DÉBLOQUÉ`, date `Débloqué le 3 septembre 2026` ; verrouille : `VERROUILLÉ`, AUCUNE date, texte `Encore 2 jours d'entraînement ou de check-in.` |
| R-5 | seed : 12 objets `category='badge'` actifs dans `ziko_shop_items` | Boutique > Badges, defiler | puce `Badges 12` ; 12 lignes visibles en defilant (> 8) ; les compteurs des autres puces = nombres reels |
| R-6 | solde 340 ; theme a 500 ; theme niveau 10 ; compte niveau 7 | Boutique > Themes ; ouvrir l'apercu de chaque objet non possede | apercu disponible pour tout objet non possede (y compris verrouille par niveau) ; theme 500 : bouton `Pièces insuffisantes` desactive + `Il te manque 160 pièces. Gagne-en en t'entraînant.` ; theme niveau 10 : `Niveau 10 requis` desactive |
| R-7 | solde 340 ; titre a 300 | Apercu du titre > `Acheter pour 300 pièces` | toast `<nom> acheté. Équipe-le dans Mes objets.` ; puce = `40` (ancien solde - prix) ; l'objet est dans Mes objets ; base : -300 dans `ziko_coin_transactions` source `purchase` |
| R-8 | 2 titres possedes, A equipe | Mes objets > `Équiper` sur B | une seule pastille `ÉQUIPÉ` par categorie, A perd la pastille dans la MEME capture ; base : `COUNT(is_equipped)` = 1 par categorie ; `equipped_title` = nom de B |
| R-9 | compte avec >= 6 transactions de pieces | Niveau > `Tout voir` | les 5 premieres lignes = les 5 plus recentes de `ziko_coin_transactions` (montant, libelle sans emoji, ordre antechronologique) ; compte sans gain : `Aucun gain pour l'instant` |
| R-10 | mode avion | Ouvrir Succes ; ouvrir Boutique ; ouvrir Quetes | Succes : carte `Succès indisponibles` + `Réessayer`, 0 ligne de succes ; Boutique : `Boutique indisponible`, 0 objet ; Quetes : `Pas de quête active` ; AUCUN des anciens textes (`Marathonien`, `Hercule`, `Battre un PR cette semaine`) ; `Réessayer` reconnecte |
| Q6 | compte lie a un coach avec branding | Mes objets > Equiper un theme | le theme du coach reste affiche ; note `Les couleurs de ton coach restent affichées...` ; apres deliaison le theme achete s'applique |
| Q7 | compte neuf | debloquer `Streak 7 jours` (tier 1) puis `50 séances` (tier 2) | +25 puis +50 pieces, une seule fois chacun (relancer l'ecran : solde inchange) |
| Q8 | `current_streak=5` | Fiche `Streak 7 jours` | `5 / 7` ; atteindre 7 via check-in OU entrainement debloque le succes |
| A11Y | TalkBack | parcourir Succes / Boutique | barres = `progressbar` avec `now/max` ; solde annonce `Solde : N pièces` ; icones seules etiquetees (`Historique des gains`, `Retour`, `Fermer`) ; cibles >= 44 dp ; contraste bouton plein `#CF4509` / blanc >= 4,5:1 |
| MOT | reduce-motion actif | debloquer un succes | icone gris->or instantanee (sinon 250 ms) |

## Verification base (SQL, lecture seule en UAT)
```sql
SELECT badge_slug, earned_at FROM ziko_user_badges WHERE user_id = :uid;
SELECT amount, source, description, created_at FROM ziko_coin_transactions WHERE user_id = :uid ORDER BY created_at DESC LIMIT 5;
SELECT si.category, COUNT(*) FILTER (WHERE ui.is_equipped) AS equipped FROM ziko_user_inventory ui JOIN ziko_shop_items si ON si.id = ui.item_id WHERE ui.user_id = :uid GROUP BY 1;  -- 0 ou 1 par categorie
```

## Deja prouve hors emulateur (rappel)
Voir `12-SUMMARY.md` : 30 scenarios SQL sur un Postgres local jetable, 13 tests de rendu (stub DOM), 30 tests unitaires. Ne prouve PAS : rendu natif, gestes, animations 250/150 ms, TalkBack, theme reellement applique au runtime, comportement sur la vraie base portfolio.
