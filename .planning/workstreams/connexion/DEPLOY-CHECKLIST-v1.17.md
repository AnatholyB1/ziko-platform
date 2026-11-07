# Deploy checklist v1.17 (human-validated actions)
- [ ] Android SHA-1 (EAS keystore + Play App Signing) -> Google Android client (GCP ziko-491420)
- [ ] Supabase portfolio: enable Google provider (Web client id, authorized client ids Web/Android/iOS first=Web, secret entered by the user)
- [ ] Supabase portfolio: enable Apple provider (client id com.ziko.mobile, no secret)
- [ ] Apple Developer: Sign In with Apple on App ID com.ziko.mobile; regenerate provisioning profile (eas credentials); new iOS build
- [ ] Google consent screen: Testing -> In production (scopes openid/email/profile)
- [ ] Decide linking vs mailer_autoconfirm=true (pre-hijack risk) before enabling providers in prod
- [ ] New native build required (google-signin config plugin iosUrlScheme in app.json, google-services.json OAuth client)

## Linking vs mailer_autoconfirm (decision utilisateur: lier seulement si email existant réellement confirmé)
- Constat: portfolio `mailer_autoconfirm=true` => tout compte email/mot de passe est "confirmé" sans preuve => pre-hijack possible via le linking auto de GoTrue.
- Correctif prod (A VALIDER, impacte les autres apps du projet partagé): mettre `mailer_autoconfirm=false` (confirmation d'email requise) ; les comptes existants déjà créés restent confirmés; vérifier que les flux d'inscription des autres apps gèrent l'email de confirmation (SMTP/templates).
- Alternative si le correctif est refusé: désactiver le linking côté produit (pas de liaison auto) => la connexion Google/Apple sur un email existant échoue et l'app affiche "Connexion par email d'abord" (code prêt côté app, voir socialAuth).
- [ ] Google consent screen: Testing -> In production (A VALIDER, publication)
- [ ] SHA-1 Play App Signing (Play Console > Integrité de l'appli) en plus du SHA-1 keystore EAS

## Verdict mailer_autoconfirm (lecture seule, 2026-11-07): RISQUE, ne PAS le desactiver maintenant
Constats:
- Portfolio utilise le service email integre Supabase (dashboard Auth > Emails: "built-in email service... not meant for production", custom SMTP desactive). Il n'envoie qu'aux adresses de l'equipe et avec une limite horaire tres basse: les emails de confirmation n'arriveraient pas aux vrais utilisateurs.
- Desactiver autoconfirm => inscriptions email/mot de passe bloquees en pratique pour TOUTES les apps du projet partage (prefixes de tables: ziko, sv_ Sevalys, gecko, rh...). Leur code n'est pas dans ce repo: dependance a l'autoconfirm non verifiable ici.
- Etat actuel: 48 utilisateurs auth, 0 non confirme, 0 anonyme, aucun marqueur `app` dans raw_app_meta_data. Mobile Ziko: register.tsx fait signUp puis onboarding immediatement (suppose une session instantanee = autoconfirm), il faudrait aussi un ecran "verifie ton email".
Etapes exactes pour fermer le risque (toutes a faire par l'utilisateur):
1. Configurer un SMTP custom (ex. Resend deja utilise par le backend): Supabase > Auth > Emails > SMTP Settings > Enable custom SMTP (host/port/user/pass saisis par l'utilisateur), expediteur de domaine verifie; personnaliser le gabarit "Confirm sign up".
2. Auth > Sign In / Providers > Email: activer "Confirm email" (= mailer_autoconfirm=false) APRES test d'un envoi reel.
3. Adapter register.tsx (ecran "verifie ton email") et verifier les flux d'inscription des apps sv_/gecko/rh.
Tant que 1-3 ne sont pas faits: risque accepte = activer Google/Apple en prod expose au pre-hijack par linking auto (email non prouve). Option: n'activer les providers qu'apres 1-3.

## Pas-a-pas dashboard (a faire par l'utilisateur)
Google (Supabase portfolio > Auth > Sign In / Providers > Google):
- Enable ON; Client IDs = Web 450830070582-72naafunl4eefm18fmudih0sv5nho3rb.apps.googleusercontent.com, puis ajouter (virgules) 450830070582-8m4aval4rinqm50ru6lt6lsj2o280lmr, 450830070582-7sl8pr0amvkjb383ckt7qa7ii3c2p852, 450830070582-16jfrfkhi1de75sm7plrljvrvjbr4rs8 (suffixe .apps.googleusercontent.com pour chacun).
- Client Secret: GCP ziko-491420 > Google Auth Platform > Clients > Ziko Web > Add secret, copier et coller dans Supabase (jamais dans un chat/commit).
- Skip Nonce Check ON (google-signin 16.1.4 n'envoie pas de nonce). Allow manual linking OFF. Save.
Apple:
- developer.apple.com > Identifiers > com.ziko.mobile > Capabilities > Sign In with Apple ON > Save; puis `eas credentials` (iOS) regenerer le provisioning profile; nouveau build iOS.
- Supabase > Providers > Apple: Enable ON, Client IDs = com.ziko.mobile, Secret vide (natif seul). Save.
Ecran de consentement Google (GCP ziko-491420 > Google Auth Platform > Audience): Publish app / In production; scopes openid, email, profile seulement (pas de verification requise).
Apres: relire https://ubxllsvanurkwkohzxau.supabase.co/auth/v1/settings (external.google/apple = true).

## SMTP Resend + confirmation email par code (valeurs a saisir par l'utilisateur)
Constat lecture seule: le backend envoie deja depuis `Ziko Coach <coach@ziko-app.com>` (backend/api/src/coach/ai/service.ts). Dans le compte Resend visible (compte anatholyb, Pro) les domaines listes sont: mail.ghjulianu-codani.com, grandouesthabitat.com, geckocabanerestaurant.com, sevalys.com, sellerieduchet.com, contact-selenium-studio.com (tous Verified). **ziko-app.com n'apparait PAS** dans ce compte: soit il est dans un autre compte/equipe Resend (celui de la cle backend), soit il n'est pas verifie. A verifier avant l'etape 1.
Etapes (ordre):
1. Resend: domaine d'envoi verifie (SPF/DKIM) ; creer une cle API dediee "supabase-portfolio-smtp" (permission envoi) ; ne jamais la coller dans un chat/commit.
2. Supabase portfolio > Auth > Emails > SMTP Settings > Enable custom SMTP: Host smtp.resend.com, Port 465, Username resend, Password = la cle API (saisie par l'utilisateur), Sender email = adresse sur le domaine verifie (ex. no-reply@ziko-app.com), Sender name = Ziko. Save.
3. Auth > Emails > Templates > Confirm sign up: Subject "Ton code de confirmation Ziko" ; corps = contenu de supabase/email-templates/confirm-signup.html (utilise {{ .Token }}, code a 6 chiffres saisi dans l'app, aucun deep link). Save.
4. Auth > Rate Limits: relever la limite d'emails/heure au besoin.
5. Test d'envoi reel AVANT de basculer: Auth > Users > inviter/creer un utilisateur de test avec une adresse de l'utilisateur, ou lancer une inscription de test; verifier reception, code, expiration.
6. Seulement apres 5: Auth > Sign In / Providers > Email: activer "Confirm email" (mailer_autoconfirm=false). Livrer la version mobile contenant l'ecran "Verifie ton email" (phase/03-email-verify) AVANT ce basculement, sinon les inscriptions des anciennes versions de l'app resteront sans session. Verifier les autres apps du projet (sv_, gecko, rh).
7. Rollback: re-cocher l'autoconfirm (Confirm email OFF).
Note: le mail "Reset password" (forgot.tsx) reste en lien par defaut: gabarit a revoir separement.

## Etat prod au 2026-11-07 (fait par l'utilisateur, relu par lecture publique de /auth/v1/settings)
- [x] Supabase portfolio: provider Google active et sauvegarde (4 Client IDs, secret, Skip Nonce Check ON). Relecture: google=true.
- [x] Apple Developer: Sign In with Apple active sur l'App ID com.ziko.mobile (provisioning profiles a regenerer au prochain build iOS).
- [ ] Supabase provider Apple (Client IDs com.ziko.mobile): relecture actuelle apple=false.
- [ ] SMTP Resend: domaine mail.ziko-app.com verifie, expediteur retenu no-reply@mail.ziko-app.com (a utiliser a l'etape 2 ci-dessus a la place de no-reply@ziko-app.com). Note: le backend envoie depuis coach@ziko-app.com (domaine racine ziko-app.com absent du compte Resend visible: a verifier, distinct de mail.ziko-app.com).
- [ ] Gabarit "Confirm sign up", test d'envoi reel, puis "Confirm email" (mailer_autoconfirm est encore true) apres livraison de l'app avec l'ecran de verification.
- [ ] Ecran de consentement Google "In production"; [ ] Google Android: les 2 clients (EAS + Play) crees.
- Preuve flux Google: AUCUN compte de test fourni => flux web/natif non teste.

## Livraison code (2026-11-07)
- [x] PR #49 mergee dans main (a38c210f), CI verte.
- [x] Build EAS Android preview lance: id 0dd523e8-f054-4678-b5b0-5dac7e45faee (pas de soumission store).
- [ ] Tester sur appareil avec ce build: Google (nouveau compte, compte existant), linking automatique, persistance de session.
- [ ] Build iOS + profil de provisioning regenere (entitlement Sign in with Apple), puis tests Apple.
- [ ] Confirm email: seulement apres livraison de l'app et test d'envoi reel Resend. Jusqu'alors le risque de pre-hijack par linking auto reste ouvert.
