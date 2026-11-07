# Deploy checklist v1.17 (human-validated actions)
- [ ] Android SHA-1 (EAS keystore + Play App Signing) -> Google Android client (GCP ziko-491420)
- [ ] Supabase portfolio: enable Google provider (Web client id, authorized client ids Web/Android/iOS first=Web, secret entered by the user)
- [ ] Supabase portfolio: enable Apple provider (client id com.ziko.mobile, no secret)
- [ ] Apple Developer: Sign In with Apple on App ID com.ziko.mobile; regenerate provisioning profile (eas credentials); new iOS build
- [ ] Google consent screen: Testing -> In production (scopes openid/email/profile)
- [ ] Decide linking vs mailer_autoconfirm=true (pre-hijack risk) before enabling providers in prod
- [ ] New native build required (google-signin config plugin iosUrlScheme in app.json, google-services.json OAuth client)
