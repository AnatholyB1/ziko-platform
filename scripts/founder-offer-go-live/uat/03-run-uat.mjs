// Real-browser UAT of /fondateurs against the DISPOSABLE stack (see 01-setup.sh / 02-run-web.sh).
// Usage: node 03-run-uat.mjs   (env: UAT_ROOT, PGBIN, CHROMIUM_PATH optional)
// Writes results.json + screenshots under .planning/workstreams/lien-invite/phases/06-founder-offer-go-live/uat/
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../../.planning/workstreams/lien-invite/phases/06-founder-offer-go-live/uat');
mkdirSync(OUT, { recursive: true });
const BASE = `http://127.0.0.1:${process.env.UAT_WEB_PORT || 3141}`;
const PGBIN = process.env.PGBIN ?? 'C:/Users/Anatholy/scoop/apps/postgresql/current/bin';
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  'C:/Users/Anatholy/AppData/Local/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe';

const sql = (q) =>
  execFileSync(`${PGBIN}/psql`, ['-h', '127.0.0.1', '-p', String(process.env.UAT_PG_PORT || 54440), '-U', 'postgres', '-At', '-F', '|', '-c', q], {
    encoding: 'utf8',
  }).trim();

const results = [];
const check = (id, label, pass, evidence) => {
  results.push({ id, label, pass: !!pass, evidence: String(evidence) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${label} :: ${evidence}`);
};

const T = {
  fr: { athlete: 'Athlète', coach: 'Coach', submit: /Réserver ma place/, generic: 'Nous vous préviendrons dès le lancement', founder: /fondateur·rice n°(\d+) sur 200/, remaining: /Plus que (\d+) places fondateur/, complete: 'Les 200 places fondateurs sont prises', pre: 'Les 200 premiers membres obtiennent le premium à vie.', invalid: 'invalide ou temporaire' },
  en: { athlete: 'Athlete', coach: 'Coach', submit: /Claim my spot/, generic: "We'll let you know as soon as we launch", founder: /founder #(\d+) of 200/, remaining: /Only (\d+) founder spots left/, complete: 'All 200 founder spots are taken', pre: 'The first 200 members get lifetime premium.', invalid: 'invalid or disposable' },
};

const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined });
const mobileCtx = () =>
  browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktopCtx = () => browser.newContext({ viewport: { width: 1440, height: 900 } });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 55 });
}
async function open(page, locale, query = '') {
  await page.goto(`${BASE}/${locale}/fondateurs${query}`, { waitUntil: 'networkidle' });
}
async function pick(page, locale, audience) {
  await page.getByRole('button', { name: T[locale][audience] }).click();
  await page.locator('#email').waitFor();
}
async function submit(page, locale, audience, email) {
  await pick(page, locale, audience);
  await page.fill('#email', email);
  await page.locator('input[name=consent]').check();
  await page.getByRole('button', { name: T[locale].submit }).click();
  await page.locator('.text-success, .text-danger').first().waitFor({ timeout: 45000 });
  const ok = await page.locator('.text-success').count();
  const text = (await page.locator(ok ? '.text-success' : '.text-danger').first().innerText()).trim();
  return { ok: ok > 0, text };
}
// Counter text on a fresh page load (the widget fetches once per mount).
async function counter(locale) {
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, locale);
  await page.waitForTimeout(800);
  const body = await page.locator('body').innerText();
  await ctx.close();
  const m = body.match(T[locale].remaining);
  return { shown: !!m, remaining: m ? Number(m[1]) : null, complete: body.includes(T[locale].complete), pre: body.includes(T[locale].pre) };
}
const seedRpc = (from, to) =>
  sql(`select count(*) from (select public.ziko_claim_waitlist_signup('seed'||g||'@example.com','athlete','fr',null,null) from generate_series(${from},${to}) g) s`);

// ---- reset state -----------------------------------------------------------------------------
sql('truncate public.ziko_waitlist_signups');
sql("select setval('public.ziko_waitlist_founder_seq',1,false)");
sql("delete from public.ziko_app_config where key='waitlist_reveal_threshold'");

// ---- A. page structure, both locales, both viewports -----------------------------------------
for (const locale of ['fr', 'en']) {
  for (const [vp, mk] of [['390x844', mobileCtx], ['1440x900', desktopCtx]]) {
    const ctx = await mk();
    const page = await ctx.newPage();
    await open(page, locale);
    check(`A-${locale}-${vp}-pre`, `${locale} ${vp}: page renders and picker offers both audiences`,
      (await page.getByRole('button', { name: T[locale].athlete }).count()) === 1 && (await page.getByRole('button', { name: T[locale].coach }).count()) === 1, 'athlete+coach buttons present');
    for (const aud of ['athlete', 'coach']) {
      await page.reload({ waitUntil: 'networkidle' });
      await pick(page, locale, aud);
      const checked = await page.locator('input[name=consent]').isChecked();
      const disabled = await page.getByRole('button', { name: T[locale].submit }).isDisabled();
      const sep = await page.evaluate(() => {
        const c = document.querySelector('input[name=consent]');
        const s = document.querySelector('button[type=submit]');
        return c.type === 'checkbox' && s.tagName === 'BUTTON' && !s.contains(c) && !c.closest('button');
      });
      const notice = await page.locator('form p.text-muted').first().innerText();
      const label = await page.locator('label:has(input[name=consent])').innerText();
      check(`A-${locale}-${vp}-${aud}`, `${locale} ${vp} ${aud}: consent unchecked by default, separate from submit, submit disabled, RGPD notice shown`,
        !checked && disabled && sep && notice.length > 40 && label.length > 20,
        `checked=${checked} submitDisabled=${disabled} separate=${sep} notice="${notice.slice(0, 90)}..."`);
      if (aud === 'athlete') {
        await page.locator('input[name=consent]').check();
        check(`A-${locale}-${vp}-enable`, `${locale} ${vp}: ticking consent enables submit`, await page.getByRole('button', { name: T[locale].submit }).isEnabled(), 'enabled after tick');
        await page.locator('input[name=consent]').uncheck();
      }
    }
    await pick(page, locale, 'athlete');
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot(page, `form-${locale}-${vp}`);
    await ctx.close();
  }
}

// ---- B. disposable domain refused ------------------------------------------------------------
{
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, 'en');
  const r = await submit(page, 'en', 'athlete', 'uat-throwaway@mailinator.com');
  await shot(page, 'disposable-refused-en-1440x900');
  const rows = sql("select count(*) from public.ziko_waitlist_signups where email ilike '%mailinator%'");
  check('B-disposable', 'disposable domain (mailinator.com) refused in the real UI, no row written', !r.ok && r.text.includes(T.en.invalid) && rows === '0', `ui="${r.text.slice(0, 70)}" rows=${rows}`);
  await ctx.close();
}
{
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, 'fr');
  const r = await submit(page, 'fr', 'coach', 'uat@yopmail.com');
  check('B-disposable-fr', 'disposable domain (yopmail.com) refused, fr/coach', !r.ok && r.text.includes(T.fr.invalid), r.text.slice(0, 80));
  await ctx.close();
}

// ---- C. real success + duplicate (WAIT-05 / WAIT-06) -----------------------------------------
let dupText;
{
  const ctx = await mobileCtx();
  const page = await ctx.newPage();
  await open(page, 'fr', '?utm_source=uat&utm_campaign=wave1');
  const r = await submit(page, 'fr', 'athlete', 'uat.dot.user@gmail.com');
  await shot(page, 'success-founder-fr-390x844');
  const m = r.text.match(T.fr.founder);
  const row = sql("select audience,locale,is_founder,founder_rank,consent_version is not null,consent_given_at is not null,utm_source,utm_campaign from public.ziko_waitlist_signups where email_normalized is not null order by created_at limit 1");
  check('C-success', 'real submit (fr/athlete, 390x844) shows the success state, founder #1', r.ok && m && m[1] === '1', `ui="${r.text}"`);
  check('C-row', 'row written with audience, locale, founder rank, consent timestamp+version, UTM', row === 'athlete|fr|t|1|t|t|uat|wave1', `row=${row}`);
  await ctx.close();

  // duplicate: same address spelled differently (Gmail dots + suffix), other locale/audience
  const ctx2 = await mobileCtx();
  const page2 = await ctx2.newPage();
  await open(page2, 'fr');
  const d = await submit(page2, 'fr', 'coach', 'uatdotuser+promo@gmail.com');
  dupText = d.text;
  await shot(page2, 'duplicate-neutral-fr-390x844');
  const n = sql('select count(*) from public.ziko_waitlist_signups');
  const aud = sql("select audience from public.ziko_waitlist_signups limit 1");
  check('C-dup', 'duplicate (Gmail dot/+suffix variant) shows success, generic sentence, NO rank / founder status', d.ok && d.text.includes(T.fr.generic) && !T.fr.founder.test(d.text), `ui="${d.text}"`);
  check('C-dup-db', 'duplicate created no second row and did not alter stored audience', n === '1' && aud === 'athlete', `rows=${n} audience=${aud}`);
  await ctx2.close();
  // same address again, exact
  const ctx3 = await desktopCtx();
  const page3 = await ctx3.newPage();
  await open(page3, 'en');
  const d2 = await submit(page3, 'en', 'athlete', 'uat.dot.user@gmail.com');
  check('C-dup-exact', 'exact duplicate (en) also neutral generic success, no rank', d2.ok && d2.text.includes(T.en.generic) && !T.en.founder.test(d2.text), `ui="${d2.text}"`);
  await ctx3.close();
}

// ---- D. coach audience, en locale, real submit -----------------------------------------------
{
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, 'en');
  const r = await submit(page, 'en', 'coach', 'uat.coach@example.com');
  await shot(page, 'success-founder-en-1440x900');
  const m = r.text.match(T.en.founder);
  const row = sql("select audience,locale,founder_rank from public.ziko_waitlist_signups where email='uat.coach@example.com'");
  check('D-coach-en', 'real submit en/coach: success, founder #2, row audience=coach locale=en', r.ok && m && m[1] === '2' && row === 'coach|en|2', `ui="${r.text}" row=${row}`);
  await ctx.close();
}

// ---- E. FOND-06 live counter reveal ----------------------------------------------------------
// E1: default threshold (no config row => 30). Seed with the REAL RPC to 100 claimed, then 169, then 170.
seedRpc(3, 100);
let c = await counter('fr');
check('E-hidden-100', 'default threshold: 100 claimed (100 left) -> counter hidden, static offer sentence shown', !c.shown && c.pre, JSON.stringify(c));
seedRpc(101, 169);
c = await counter('fr');
check('E-hidden-169', 'default threshold 30: 169 claimed (31 left) -> still hidden', !c.shown, JSON.stringify(c));
seedRpc(170, 170);
c = await counter('fr');
check('E-reveal-30', 'default threshold 30: 170 claimed -> counter appears with the real value 30', c.shown && c.remaining === 30, JSON.stringify(c));

// E2: threshold set LOW on the disposable DB; restart from a clean table and reveal via real UI signups.
sql('truncate public.ziko_waitlist_signups');
sql("select setval('public.ziko_waitlist_founder_seq',1,false)");
sql("insert into public.ziko_app_config(key,value) values ('waitlist_reveal_threshold','12'::jsonb) on conflict (key) do update set value=excluded.value");
const thr = sql("select value from public.ziko_app_config where key='waitlist_reveal_threshold'");
seedRpc(1, 186); // 186 claimed => 14 left, above threshold 12
c = await counter('en');
check('E-low-hidden', `threshold=${thr}: 186 claimed (14 left) -> hidden`, !c.shown, JSON.stringify(c));
const observed = [];
for (let i = 1; i <= 6; i++) {
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, i % 2 ? 'fr' : 'en');
  const r = await submit(page, i % 2 ? 'fr' : 'en', i % 2 ? 'athlete' : 'coach', `live${i}@example.com`);
  const rankM = r.text.match(/(\d+)/);
  const cc = await counter(i % 2 ? 'fr' : 'en');
  observed.push({ claimedRank: rankM ? Number(rankM[1]) : null, counter: cc.remaining, shown: cc.shown });
  if (i === 3) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, 'counter-live-fr-1440x900');
  }
  await ctx.close();
}
console.log(JSON.stringify(observed));
const vals = observed.filter((o) => o.shown).map((o) => o.counter);
check('E-live-sequence', 'live reveal via real submissions: counter appears at threshold, shows 200-claimed exactly, strictly decreasing', observed[0].shown === false && observed.filter((o) => o.shown).length >= 4 && observed.find((o) => o.shown).counter === 12,
  `observed=${JSON.stringify(observed)}`);
check('E-monotonic', 'counter never increases between consecutive observations', vals.length >= 4 && vals.every((v, i) => i === 0 || v < vals[i - 1]), `values=${vals.join('>')}`);
check('E-exact', 'every shown value equals 200 - founders claimed in the DB at that moment', observed.every((o) => !o.shown || o.counter === 200 - o.claimedRank), JSON.stringify(observed));

// E3: full state at 200 (seed to 199 with the real RPC, 200th is a real UI signup, 201st a real UI signup)
const claimed = Number(sql('select count(*) from public.ziko_waitlist_signups where is_founder'));
seedRpc(1000, 1000 + (199 - claimed - 1));
c = await counter('fr');
check('E-one-left', 'after seeding to 199 founders the counter shows "Plus que 1"', c.shown && c.remaining === 1, JSON.stringify({ claimed: sql('select count(*) from public.ziko_waitlist_signups where is_founder'), ...c }));
{
  const ctx = await mobileCtx();
  const page = await ctx.newPage();
  await open(page, 'fr');
  await shot(page, 'counter-one-left-fr-390x844');
  const r = await submit(page, 'fr', 'athlete', 'founder200@example.com');
  const m = r.text.match(T.fr.founder);
  check('E-200th', 'the 200th real signup is told founder #200', r.ok && m && m[1] === '200', r.text);
  await ctx.close();
}
c = await counter('fr');
{
  const ctx = await mobileCtx();
  const page = await ctx.newPage();
  await open(page, 'fr');
  await page.waitForTimeout(800);
  await shot(page, 'counter-complete-fr-390x844');
  await ctx.close();
}
check('E-full', 'at 200 founders the widget flips to the complete state (heading), no remaining number', c.complete && !c.shown, JSON.stringify(c));
{
  const ctx = await desktopCtx();
  const page = await ctx.newPage();
  await open(page, 'fr');
  const r = await submit(page, 'fr', 'athlete', 'late201@example.com');
  const row = sql("select is_founder, founder_rank from public.ziko_waitlist_signups where email='late201@example.com'");
  check('E-201st', 'the 201st signup succeeds as non-founder (is_founder=false, rank 201 stored but never shown) with the generic sentence', r.ok && r.text.includes(T.fr.generic) && row === 'f|201', `ui="${r.text}" row=${row}`);
  // WAIT-06 indistinguishability: duplicate success text === non-founder new success text
  check('WAIT-06-same', 'duplicate success text is identical to a brand-new non-founder success text (no oracle)', r.ok && r.text === dupText, `new201="${r.text}" duplicate="${dupText}"`);
  await ctx.close();
}
const final = sql('select count(*), count(*) filter (where is_founder), max(founder_rank) from public.ziko_waitlist_signups');
console.log('final counts', final);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), observed, final, results }, null, 2));
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
