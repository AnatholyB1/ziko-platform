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
