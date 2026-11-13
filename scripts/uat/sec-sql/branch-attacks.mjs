// Rejoue les attaques de l'audit securite v1.20 (et les flux legitimes) via l'API REST de la BRANCHE DE TEST uniquement.
// Usage : node scripts/uat/sec-sql/branch-attacks.mjs before|after   [UAT_ENV_FILE=chemin du fichier d'env]
// Les cles (publishable, service_role, mots de passe) sont lues dans le fichier d'env et JAMAIS affichees.
// Garde-fou : l'URL doit contenir la ref de la branche (oloobswzsziidjwycthm) et jamais celle de la prod.
import { readFileSync } from 'node:fs';

const mode = process.argv[2];
if (!['before', 'after'].includes(mode)) { console.error('usage: before|after'); process.exit(2); }
const BRANCH = 'oloobswzsziidjwycthm', PROD = 'ubxllsvanurkwkohzxau';
const file = process.env.UAT_ENV_FILE || 'C:/ziko-platform/.claude/worktrees/integration-v1.20/.uat/env';
const env = {};
for (const l of readFileSync(file, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const url = env.SUPABASE_URL;
if (!url || !url.includes(BRANCH) || url.includes(PROD)) { console.error('REFUSED: URL is not the test branch'); process.exit(2); }
const ANON = env.SUPABASE_PUBLISHABLE_KEY, SERVICE = env.UAT_SERVICE_ROLE_KEY;

async function call(path, { key, jwt, method = 'GET', body, headers = {} }) {
  const res = await fetch(`${url}${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { apikey: key, Authorization: `Bearer ${jwt ?? key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
  });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
async function login(email, password) {
  const r = await call('/auth/v1/token?grant_type=password', { key: ANON, method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error('login failed ' + r.status);
  return { jwt: r.body.access_token, id: r.body.user.id };
}
const rpc = (who, fn, body) => call(`/rest/v1/rpc/${fn}`, { key: who === 'service' ? SERVICE : ANON, jwt: who === 'service' ? SERVICE : who === 'anon' ? ANON : who.jwt, method: 'POST', body });
const rest = (who, path, method = 'GET', body) => call(`/rest/v1/${path}`, { key: who === 'service' ? SERVICE : ANON, jwt: who === 'service' ? SERVICE : who === 'anon' ? ANON : who.jwt, method, body });

const ath = await login(env.UAT_ATHLETE_EMAIL, env.UAT_ATHLETE_PASSWORD);
const coach = await login(env.UAT_COACH_EMAIL, env.UAT_COACH_PASSWORD);
let pass = 0, fail = 0;
const tag = Date.now().toString(36);
const report = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' ' + extra}`); };
const blocked = (r) => r.status >= 400;
const brief = (r) => `${r.status} ${typeof r.body === 'string' ? r.body.slice(0, 80) : JSON.stringify(r.body).slice(0, 120)}`;
// AVANT : on constate le succes de l'attaque (information) ; APRES : on exige qu'elle soit bloquee.
const attack = (name, r, okWhen = (x) => !blocked(x)) => {
  const succeeded = okWhen(r);
  if (mode === 'before') { console.log(`  ${succeeded ? 'ATTAQUE REUSSIE ' : 'attaque bloquee  '} ${name} -> ${brief(r)}`); }
  else report(`attaque bloquee : ${name}`, !succeeded, brief(r));
};
const legit = (name, cond, extra = '') => { if (mode === 'before') console.log(`  legit ${cond ? 'ok     ' : 'KO     '} ${name} ${cond ? '' : extra}`); else report(`flux legitime : ${name}`, cond, extra); };

console.log(`Mode ${mode} sur la branche ${BRANCH}`);
console.log('\n-- Attaques (cle publiable / JWT athlete uniquement)');
attack('anon ziko_earn_ai_credits', await rpc('anon', 'ziko_earn_ai_credits', { p_user_id: ath.id, p_source: 'audit', p_idempotency_key: `atk-${tag}-1`, p_amount: 1, p_daily_cap: 1000000 }));
attack('anon ziko_deduct_ai_credits (victime = coach)', await rpc('anon', 'ziko_deduct_ai_credits', { p_user_id: coach.id, p_cost: 0, p_action_type: 'chat', p_idempotency_key: `atk-${tag}-2` }));
attack('athlete ziko_deduct_ai_credits (victime = coach)', await rpc(ath, 'ziko_deduct_ai_credits', { p_user_id: coach.id, p_cost: 0, p_action_type: 'chat', p_idempotency_key: `atk-${tag}-2b` }));
attack('anon ziko_award_coins', await rpc('anon', 'ziko_award_coins', { p_user_id: ath.id, p_amount: 1, p_source: 'habit', p_source_id: null, p_description: 'audit' }));
attack('athlete ziko_award_coins pour le coach', await rpc(ath, 'ziko_award_coins', { p_user_id: coach.id, p_amount: 1, p_source: 'habit', p_source_id: null, p_description: 'audit' }));
attack('athlete ziko_award_coins demesure pour soi', await rpc(ath, 'ziko_award_coins', { p_user_id: ath.id, p_amount: 500000, p_source: 'habit', p_source_id: null, p_description: 'audit' }));
attack('anon ziko_award_xp', await rpc('anon', 'ziko_award_xp', { p_user_id: ath.id, p_amount: 1, p_source: 'habit', p_source_id: null, p_description: 'audit' }));
attack('anon ziko_send_coin_gift (expediteur = coach)', await rpc('anon', 'ziko_send_coin_gift', { p_sender_id: coach.id, p_receiver_id: ath.id, p_amount: 1, p_message: null }), (x) => !blocked(x));
attack('athlete ziko_send_coin_gift au nom du coach', await rpc(ath, 'ziko_send_coin_gift', { p_sender_id: coach.id, p_receiver_id: ath.id, p_amount: 1, p_message: null }));
attack('athlete ziko_send_xp_gift au nom du coach', await rpc(ath, 'ziko_send_xp_gift', { p_sender_id: coach.id, p_receiver_id: ath.id, p_amount: 1, p_message: null }));
attack('anon ziko_purchase_shop_item', await rpc('anon', 'ziko_purchase_shop_item', { p_user_id: ath.id, p_item_id: '00000000-0000-0000-0000-000000000000' }));
attack('anon ziko_ensure_gamification_profile', await rpc('anon', 'ziko_ensure_gamification_profile', { p_user_id: ath.id }));
attack('athlete ziko_ensure_gamification_profile du coach', await rpc(ath, 'ziko_ensure_gamification_profile', { p_user_id: coach.id }));
attack('anon ziko_increment_community_stat', await rpc('anon', 'ziko_increment_community_stat', { p_user_id: ath.id, p_field: 'messages_sent', p_amount: 1 }));
attack('athlete ziko_increment_community_stat sur le coach (messages_sent)', await rpc(ath, 'ziko_increment_community_stat', { p_user_id: coach.id, p_field: 'messages_sent', p_amount: 1 }));
attack('anon ziko_create_form_instances_for_trigger', await rpc('anon', 'ziko_create_form_instances_for_trigger', { p_trigger_type: 'manual', p_athlete_id: ath.id, p_coach_id: coach.id }));
attack('athlete ziko_create_form_instances_for_trigger', await rpc(ath, 'ziko_create_form_instances_for_trigger', { p_trigger_type: 'manual', p_athlete_id: ath.id, p_coach_id: coach.id }));
attack('anon ziko_search_users_fuzzy (enumeration)', await rpc('anon', 'ziko_search_users_fuzzy', { search_query: 'a', calling_user_id: ath.id, result_limit: 20 }), (x) => !blocked(x) && Array.isArray(x.body) && x.body.length > 0);
attack('anon ziko_is_coach_of (oracle de relation)', await rpc('anon', 'ziko_is_coach_of', { coach: coach.id, client: ath.id }), (x) => x.body === true);
attack('athlete ziko_is_coach_of entre deux tiers (coach / coach)', await rpc(ath, 'ziko_is_coach_of', { coach: coach.id, client: coach.id }), (x) => x.body === true);
const prof0 = (await rest('service', `ziko_user_profiles?id=eq.${ath.id}&select=tier,subscription_tier,is_lifetime_premium,is_public,name`)).body[0];
attack('athlete PATCH profil is_lifetime_premium/subscription_tier', await rest(ath, `ziko_user_profiles?id=eq.${ath.id}`, 'PATCH', { is_lifetime_premium: true, subscription_tier: 'premium' }));
await rest('service', `ziko_user_profiles?id=eq.${ath.id}`, 'PATCH', { tier: prof0.tier, subscription_tier: prof0.subscription_tier, is_lifetime_premium: prof0.is_lifetime_premium });
const ins = await rest(ath, 'ziko_ai_cost_log', 'POST', { user_id: ath.id, model: 'audit', source: `audit-${tag}`, input_tokens: 0, output_tokens: 0 });
attack('athlete INSERT ziko_ai_cost_log', ins);
const del = await rest(ath, `ziko_ai_cost_log?source=eq.audit-${tag}`, 'DELETE');
attack('athlete DELETE ziko_ai_cost_log', del, (x) => !blocked(x) && Array.isArray(x.body) && x.body.length > 0);
await rest('service', `ziko_ai_cost_log?source=eq.audit-${tag}`, 'DELETE');
const inv = (await rest('service', `ziko_user_inventory?user_id=eq.${ath.id}&select=id,item_id&limit=1`)).body[0];
if (inv) {
  attack('athlete PATCH ziko_user_inventory.item_id', await rest(ath, `ziko_user_inventory?id=eq.${inv.id}`, 'PATCH', { item_id: inv.item_id }), (x) => !blocked(x));
} else console.log('  (inventaire vide pour l athlete : attaque item_id non rejouee)');
// profil prive lu par un non-ami
const coachPub = (await rest('service', `ziko_user_profiles?id=eq.${coach.id}&select=is_public`)).body[0]?.is_public;
const friend = (await rest('service', `ziko_friendships?or=(and(requester_id.eq.${ath.id},addressee_id.eq.${coach.id}),and(requester_id.eq.${coach.id},addressee_id.eq.${ath.id}))&status=eq.accepted&select=id`)).body;
if (friend.length === 0) {
  await rest('service', `ziko_user_profiles?id=eq.${coach.id}`, 'PATCH', { is_public: false });
  const pr = await rpc(ath, 'ziko_get_public_profile', { p_user: coach.id });
  await rest('service', `ziko_user_profiles?id=eq.${coach.id}`, 'PATCH', { is_public: coachPub ?? true });
  attack('athlete (non-ami) ziko_get_public_profile d un profil PRIVE', pr, (x) => !blocked(x) && x.body && x.body.is_private !== true && ('badges' in x.body) && (x.body.badges?.length > 0 || x.body.goal != null || x.body.level != null || x.body.recent_workouts?.length > 0 || x.body.streak > 0 || x.body.is_private === undefined));
  if (mode === 'after') report('profil prive : contrat minimal (is_private, goal null, listes vides)', pr.body?.is_private === true && pr.body.goal === null && pr.body.badges?.length === 0 && pr.body.recent_workouts?.length === 0, brief(pr));
} else console.log('  (athlete et coach amis : test du profil prive non rejoue)');

console.log('\n-- Flux legitimes');
const isOk = (r) => !blocked(r);
legit('athlete : award_coins pour soi (habit, 1)', isOk(await rpc(ath, 'ziko_award_coins', { p_user_id: ath.id, p_amount: 1, p_source: 'habit', p_source_id: null, p_description: 'audit flux' })));
legit('athlete : award_xp pour soi (habit, 1)', isOk(await rpc(ath, 'ziko_award_xp', { p_user_id: ath.id, p_amount: 1, p_source: 'habit', p_source_id: null, p_description: 'audit flux' })));
legit('athlete : ensure_gamification_profile pour soi', isOk(await rpc(ath, 'ziko_ensure_gamification_profile', { p_user_id: ath.id })));
const item = (await rest('service', 'ziko_shop_items?select=id&limit=1')).body[0];
if (item) {
  const pr = await rpc(ath, 'ziko_purchase_shop_item', { p_user_id: ath.id, p_item_id: item.id });
  legit('athlete : purchase_shop_item pour soi (reponse metier, pas d exception)', isOk(pr) && typeof pr.body === 'object', brief(pr));
}
const gift = await rpc(ath, 'ziko_send_coin_gift', { p_sender_id: ath.id, p_receiver_id: coach.id, p_amount: 1, p_message: 'audit' });
legit('athlete : send_coin_gift expediteur = soi', isOk(gift), brief(gift));
const xgift = await rpc(ath, 'ziko_send_xp_gift', { p_sender_id: ath.id, p_receiver_id: coach.id, p_amount: 1, p_message: 'audit' });
legit('athlete : send_xp_gift expediteur = soi', isOk(xgift), brief(xgift));
legit('athlete : increment de sa statistique', isOk(await rpc(ath, 'ziko_increment_community_stat', { p_user_id: ath.id, p_field: 'messages_sent', p_amount: 1 })));
legit('athlete : encouragement recu par un autre (+1)', isOk(await rpc(ath, 'ziko_increment_community_stat', { p_user_id: coach.id, p_field: 'encouragements_received', p_amount: 1 })));
const rel = await rpc(ath, 'ziko_is_coach_of', { coach: coach.id, client: ath.id });
const linkRows = (await rest('service', `ziko_coach_client_links?coach_id=eq.${coach.id}&client_id=eq.${ath.id}&revoked_at=is.null&select=id`)).body;
legit('athlete : is_coach_of(coach, moi) coherent avec le lien reel', isOk(rel) && rel.body === (linkRows.length > 0), brief(rel));
const own = await rest(ath, `ziko_user_profiles?id=eq.${ath.id}&select=id,name`);
legit('athlete : lecture de son profil (RLS)', isOk(own) && own.body.length === 1);
const upd = await rest(ath, `ziko_user_profiles?id=eq.${ath.id}`, 'PATCH', { name: prof0.name, is_public: prof0.is_public });
legit('athlete : mise a jour nom / is_public', isOk(upd) && upd.body.length === 1, brief(upd));
legit('anon : lecture profils = 0 ligne sans erreur (RLS + is_coach_of)', await (async () => { const r = await rest('anon', 'ziko_user_profiles?select=id&limit=3'); return isOk(r) && Array.isArray(r.body) && r.body.length === 0; })());
if (linkRows.length) {
  const cr = await rest(coach, `ziko_user_profiles?id=eq.${ath.id}&select=id`);
  legit('coach : lecture du profil de son athlete (policy user_profiles_coach_read)', isOk(cr) && cr.body.length === 1, brief(cr));
}
legit('athlete : lecture de son journal de cout IA (SELECT own)', isOk(await rest(ath, `ziko_ai_cost_log?user_id=eq.${ath.id}&select=id&limit=1`)));
legit('athlete : recherche fuzzy avec son id', isOk(await rpc(ath, 'ziko_search_users_fuzzy', { search_query: 'a', calling_user_id: ath.id, result_limit: 5 })));
legit('athlete : recherche d amis (ziko_search_users_with_status)', isOk(await rpc(ath, 'ziko_search_users_with_status', { p_query: 'ab', p_limit: 5 })));
legit('athlete : profil public du coach', isOk(await rpc(ath, 'ziko_get_public_profile', { p_user: coach.id })));
legit('athlete : badges (appel imbrique award_coins)', isOk(await rpc(ath, 'ziko_check_and_award_badges', { p_user_id: ath.id })));
legit('athlete : quetes (appel imbrique award_coins)', isOk(await rpc(ath, 'ziko_sync_quests', { p_user_id: ath.id })));
legit('athlete : liste des defis collectifs', isOk(await rpc(ath, 'ziko_list_collective_challenges', {})));
legit('service_role : earn_ai_credits (backend creditService)', isOk(await rpc('service', 'ziko_earn_ai_credits', { p_user_id: ath.id, p_source: 'audit', p_idempotency_key: `srv-${tag}-1`, p_amount: 0, p_daily_cap: 1000000 })));
const dd = await rpc('service', 'ziko_deduct_ai_credits', { p_user_id: ath.id, p_cost: 0, p_action_type: 'chat', p_idempotency_key: `srv-${tag}-2` });
// Bug PREEXISTANT (hors perimetre, voir FIX-SECURITY.md) : ON CONFLICT sans WHERE -> 42P10 quand le solde suffit.
// La fonction est atteinte (pas de permission denied) : c'est ce que ce test verifie.
legit('service_role : deduct_ai_credits atteint (backend creditService ; 42P10 preexistant toleree)', isOk(dd) || (dd.status === 400 && /ON CONFLICT/.test(JSON.stringify(dd.body))), brief(dd));
legit('service_role : create_form_instances_for_trigger (backend)', isOk(await rpc('service', 'ziko_create_form_instances_for_trigger', { p_trigger_type: 'manual', p_athlete_id: ath.id, p_coach_id: coach.id })));
const sins = await rest('service', 'ziko_ai_cost_log', 'POST', { user_id: ath.id, model: 'audit', source: `audit-srv-${tag}`, input_tokens: 0, output_tokens: 0 });
legit('service_role : ecriture ziko_ai_cost_log (backend)', isOk(sins), brief(sins));
await rest('service', `ziko_ai_cost_log?source=eq.audit-srv-${tag}`, 'DELETE');
const sup = await rest('service', `ziko_user_profiles?id=eq.${ath.id}`, 'PATCH', { tier: prof0.tier });
legit('service_role : ecriture ziko_user_profiles.tier (backend)', isOk(sup), brief(sup));

if (mode === 'after') console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(mode === 'after' && fail ? 1 : 0);
