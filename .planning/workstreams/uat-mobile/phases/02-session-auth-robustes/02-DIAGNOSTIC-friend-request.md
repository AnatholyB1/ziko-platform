# Diagnostic : "Impossible d'envoyer la demande" (SESS-04)

## Site
`apps/mobile/src/components/SearchOverlay.tsx` : bouton "ajouter un ami" des resultats utilisateurs.
Avant : `supabase.from('ziko_friendships').insert({ requester_id: userId, ... })` dans un `try/catch` qui avalait l'erreur et affichait un message unique.

## Analyse (lecture de code + schema ; pas de reproduction emulateur, pas d'acces base)
- RLS (`portfolio_ziko_schema.sql` l.2227) : `friendships_insert WITH CHECK (auth.uid() = requester_id)`. Le `REVOKE` de `20261107170000_ziko_revoke_client_dml.sql` laisse INSERT a `authenticated` : pas la cause.
- Contrainte `UNIQUE (requester_id, addressee_id)` et `CHECK requester_id <> addressee_id`.
- Causes plausibles de l'echec, toutes ecrasees en un seul message generique :
  1. **Session/JWT perime (cause principale, meme famille que SESS-01..03)** : `requester_id` vient du store (`user.id`, correct) mais la requete part avec le JWT courant du client. Apres arriere-plan prolonge l'auto-refresh etait suspendu, le JWT expire est vu comme `anon` -> `auth.uid()` NULL -> RLS refuse (42501). L'UI affichait "Impossible d'envoyer la demande".
  2. Doublon : relancer sur un utilisateur deja demande -> 23505 (unique), signale comme echec.
  3. Demande inverse deja existante (B a deja demande A) : l'insert A->B passe (cle differente) et cree un doublon croise ; non traite ici (perimetre P21).
- Non verifie sans emulateur : laquelle des causes 1 ou 2 a ete vue en UAT.

## Correction (dans le perimetre auth)
- `src/lib/friendRequest.ts` `sendFriendRequestFromSearch` : l'id demandeur vient de `sessionManager.requireUser()` (session rafraichie), erreurs distinguees : 23505 -> traite comme "deja envoye" (bouton passe a Envoye), 42501/JWT -> message de session expiree, autre -> message generique "Reessaie".
- La cause 1 est aussi traitee a la racine par le rafraichissement au premier plan (AppState).

## Transmis a P21 (hors perimetre)
- Cas 3 (demande inverse / deja amis) : exclure ou etiqueter dans la RPC `ziko_search_users_fuzzy` les utilisateurs deja amis ou avec demande recue ; unifier "Suivre"/"ami". Reproduction : A envoie a B, puis B cherche A et clique ajouter -> deux lignes (A,B) et (B,A).
- `plugins/community/src/store.ts` `sendFriendRequest` ignore silencieusement l'erreur d'insert (pas de retour) : a corriger avec l'UX Amis.
