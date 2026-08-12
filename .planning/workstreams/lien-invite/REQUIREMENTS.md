# Requirements: Ziko Platform — v1.16 Waitlist Fondateurs & Accès Anticipé

**Defined:** 2026-08-12
**Workstream:** `lien-invite`
**Core Value:** Capturer les emails des personnes intéressées par l'accès anticipé à Ziko, athlètes comme coachs, et tenir une promesse « premium à vie » pour les 200 premiers qui soit vraie dans le contrat comme dans le code.

## Decisions Locked

Prises avec l'utilisateur avant rédaction, elles contraignent tout ce qui suit :

| Décision | Choix retenu |
|----------|--------------|
| Compteur public | Différé. Offre en fait statique au lancement ; révélation d'un décompte **décroissant** (« X places restantes ») seulement au-delà d'un seuil de remplissage |
| Plafond fondateurs | **200 au total**, toutes audiences confondues — une seule séquence, un seul compteur |
| Utilisateurs premium existants | Aucun vrai utilisateur en `tier='premium'` — pas de phase de grand-père (**hypothèse à vérifier**, voir CRED-01) |
| Parcours coach existants | `/coach/onboarding` et `/coach/dashboard` **cohabitent** avec la waitlist, aucun gating |

## v1 Requirements

### Data & Intégrité (DATA)

- [ ] **DATA-01**: Une inscription à la waitlist est stockée avec son email, son audience (athlète ou coach), son horodatage et son rang fondateur
- [ ] **DATA-02**: Le rang fondateur est attribué par une `SEQUENCE` Postgres, de sorte que deux inscriptions simultanées ne peuvent jamais recevoir le même rang
- [ ] **DATA-03**: Le plafond de 200 places fondateur est exact sous n'importe quelle concurrence — la 201ᵉ inscription est acceptée mais sans statut fondateur
- [ ] **DATA-04**: Une adresse email déjà inscrite ne crée pas de doublon et ne consomme pas une seconde place fondateur
- [ ] **DATA-05**: La table waitlist a RLS activé sans aucune politique — aucun rôle ne peut lire ou écrire directement
- [ ] **DATA-06**: Toute écriture et toute lecture passent par des RPC `SECURITY DEFINER`, selon l'idiome déjà utilisé par `deduct_ai_credits` et `is_coach_of()`
- [ ] **DATA-07**: Un visiteur ne peut pas déterminer si une adresse email donnée est déjà inscrite (réponse indistinguable, comme l'enveloppe `INVALID_OR_EXPIRED` des codes d'invitation)

### Page waitlist (WAIT)

- [ ] **WAIT-01**: Un visiteur accède à une page publique dédiée à l'offre fondateurs, servie en français et en anglais
- [ ] **WAIT-02**: Le visiteur choisit son profil (athlète ou coach) avant que le champ email n'apparaisse — divulgation progressive, pas un champ de formulaire supplémentaire
- [ ] **WAIT-03**: Le formulaire ne demande qu'une seule information saisie : l'adresse email
- [ ] **WAIT-04**: Une adresse mal formée ou issue d'un domaine jetable est refusée avec un message explicite
- [ ] **WAIT-05**: Après soumission, le visiteur voit un état de succès en ligne confirmant son inscription et son statut fondateur si une place lui a été attribuée
- [ ] **WAIT-06**: Le visiteur qui soumet une adresse déjà inscrite reçoit le même état de succès, sans révéler qu'elle existait déjà
- [ ] **WAIT-07**: La page respecte le thème sport clair existant et les tokens Tailwind v4 de `globals.css`
- [ ] **WAIT-08**: La page reste rendue statiquement, seul le compteur étant servi dynamiquement

### Offre fondateurs & compteur (FOND)

- [ ] **FOND-01**: La page présente l'offre « les 200 premiers membres obtiennent le premium à vie » comme un fait, sans compteur, tant que le seuil de révélation n'est pas atteint
- [ ] **FOND-02**: Au-delà du seuil de remplissage, la page affiche le nombre de places **restantes**, en décroissant
- [ ] **FOND-03**: Le nombre affiché est toujours issu d'une requête réelle — jamais décalé, arrondi ou fabriqué
- [ ] **FOND-04**: Le nombre affiché ne peut jamais augmenter du point de vue du visiteur
- [ ] **FOND-05**: Une fois les 200 places prises, la page affiche un état « complet » distinct et continue d'accepter les inscriptions sans statut fondateur
- [ ] **FOND-06**: Le seuil de révélation du compteur est configurable sans redéploiement

### Alignement crédits IA (CRED)

- [ ] **CRED-01**: Avant toute modification, un décompte des utilisateurs en `tier='premium'` en production confirme l'hypothèse « aucun vrai utilisateur concerné » ; si elle est fausse, le travail s'arrête et la question du grand-père remonte à l'utilisateur
- [ ] **CRED-02**: Un utilisateur premium n'a plus d'accès illimité à l'IA — le contournement inconditionnel du gate de crédits est supprimé
- [ ] **CRED-03**: Un utilisateur premium reçoit une allocation mensuelle de crédits IA généreuse mais finie
- [ ] **CRED-04**: Un fondateur conserve son avantage à vie même si un abonnement payant ultérieur est souscrit puis résilié
- [ ] **CRED-05**: Le changement de comportement du gate est protégé par un feature flag, pour découpler le déploiement de l'activation
- [ ] **CRED-06**: Aucun appelant existant lisant `tier` ne régresse

### Légal & conformité (LEGAL)

- [ ] **LEGAL-01**: Une page CGV publique existe, en français et en anglais
- [ ] **LEGAL-02**: Les CGV énoncent que le premium ouvre toutes les fonctionnalités mais que les crédits IA restent plafonnés
- [ ] **LEGAL-03**: Les CGV précisent la portée de l'engagement « à vie » sans se réserver un droit de modification unilatérale illimité
- [ ] **LEGAL-04**: Les CGU sont révisées pour être cohérentes avec les CGV sur le plafond de crédits IA
- [ ] **LEGAL-05**: Le texte légal décrivant le plafond est en ligne avant ou en même temps que l'activation du changement de code, jamais après
- [ ] **LEGAL-06**: Le formulaire présente une case de consentement décochée par défaut et dissociée du bouton d'inscription
- [ ] **LEGAL-07**: La mention d'information RGPD figure au point de collecte, pas seulement en pied de page
- [ ] **LEGAL-08**: Une durée de conservation des adresses est définie et documentée
- [ ] **LEGAL-09**: Un inscrit peut demander l'effacement de son adresse et obtenir sa suppression

### Nettoyage base (PURGE)

- [ ] **PURGE-01**: Les critères identifiant un compte de test sont écrits et relus avant toute suppression
- [ ] **PURGE-02**: Un export en simulation liste exactement les comptes qui seraient supprimés, sans rien supprimer
- [ ] **PURGE-03**: Un point de sauvegarde restaurable existe avant la suppression
- [ ] **PURGE-04**: La suppression passe par l'API Admin déjà éprouvée dans `account.ts`, jamais par du SQL en masse
- [ ] **PURGE-05**: Après suppression, aucune ligne orpheline ne subsiste dans les tables liées

### Points d'entrée (ENTRY)

- [ ] **ENTRY-01**: Un visiteur atteint la page fondateurs depuis la page d'accueil
- [ ] **ENTRY-02**: Un visiteur atteint la page fondateurs depuis la page `/coachs`
- [ ] **ENTRY-03**: Un visiteur atteint la page fondateurs depuis l'en-tête et le pied de page du site
- [ ] **ENTRY-04**: Le partage du lien sur les réseaux sociaux affiche un aperçu correct (métadonnées OG et Twitter card)
- [ ] **ENTRY-05**: La page est indexable et présente dans le sitemap
- [ ] **ENTRY-06**: Les conversions de la page sont mesurables

## v2 Requirements

Reconnus mais hors de ce milestone.

### Engagement
- **ENG-01**: L'inscrit reçoit un email de confirmation automatique
- **ENG-02**: Double opt-in sur l'adresse email
- **ENG-03**: L'inscrit reçoit un lien de parrainage et remonte dans la file
- **ENG-04**: L'inscrit voit son rang dans la file d'attente
- **ENG-05**: Ouverture de l'accès par vagues depuis une interface d'administration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Compteur croissant « X / 200 inscrits » | Un chiffre réel bas se lit comme un échec ; remplacé par un décompte décroissant révélé au-delà d'un seuil |
| Compteur gonflé, décalé ou simulé | Pratique commerciale trompeuse ; priorité de contrôle DGCCRF 2025-2028 |
| Minuteur de compte à rebours | Rareté artificielle, aucun fondement réel dans l'offre |
| Partage social obligatoire pour avancer | Anti-pattern documenté, dégrade la confiance |
| Popup d'intention de sortie | Anti-pattern documenté |
| Champs supplémentaires au formulaire | Chaque champ coûte de la conversion ; la qualification se fait après inscription |
| Route séparée par audience | Dilue les liens entrants et double la maintenance ; une page, sélecteur de rôle |
| Gating des parcours coach existants | Décision utilisateur : cohabitation, la waitlist est un canal supplémentaire |
| Phase de grand-père des premium existants | Décision utilisateur : aucun vrai utilisateur concerné (vérifié par CRED-01) |
| SaaS de waitlist tiers | Supabase, Resend et Upstash sont déjà en place et gardent la donnée en première partie |
| Vérification MX/SMTP des adresses | Latence et coût disproportionnés pour de la capture de prospect |

## Assumptions

À vérifier pendant l'exécution, pas avant :

- **A-01**: Aucun vrai utilisateur ne détient `tier='premium'` en production. Vérifiée par CRED-01 au démarrage de la phase crédits. Si fausse, la suppression du contournement expose l'entreprise en droit de la consommation et la décision remonte à l'utilisateur.
- **A-02**: Le seuil de révélation du compteur autour de 10 à 15 % du plafond est une inférence raisonnée, pas un chiffre sourcé. FOND-06 le rend ajustable sans redéploiement, précisément pour cette raison.

## Lawyer Review Required

Points que la recherche a explicitement refusé de trancher :

- Rédaction de la clause « à vie » au regard de l'article R.212-1 du Code de la consommation
- Sort d'une place fondateur revendiquée face à une demande d'effacement RGPD
- Applicabilité du régime des clauses abusives à un avantage gratuit à vie

## Traceability

À remplir lors de la création du roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(pending roadmap)* | — | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 0
- Unmapped: 47 ⚠️

---
*Requirements defined: 2026-08-12*
