#!/usr/bin/env node
// Genere backend/api/.env.uat (gitignore) pour le backend UAT local. Ne lit JAMAIS .env.local.
// Usage: node scripts/uat/make-backend-env.mjs [chemin .uat/env de l'integration]
// - SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY lus dans .uat/env
// - SUPABASE_SERVICE_KEY = cle service_role de la branche (via CLI supabase, jamais affichee)
//   et ajoutee en UAT_SERVICE_ROLE_KEY dans .uat/env
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = 'oloobswzsziidjwycthm';
const here = dirname(fileURLToPath(import.meta.url));
const uatEnvPath = resolve(process.argv[2] ?? 'C:/ziko-platform/.claude/worktrees/integration-v1.20/.uat/env');
const outPath = resolve(here, '../../backend/api/.env.uat');

const parse = (t) => Object.fromEntries(t.split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const uat = parse(readFileSync(uatEnvPath, 'utf8'));
if (!uat.SUPABASE_URL?.includes(REF)) throw new Error(`SUPABASE_URL ne contient pas ${REF}: abandon`);

let svc = uat.UAT_SERVICE_ROLE_KEY;
if (!svc) {
  const out = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', REF, '-o', 'json'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const keys = JSON.parse(out.slice(out.indexOf('[')));
  svc = keys.find((k) => k.name === 'service_role')?.api_key;
  if (!svc) throw new Error('service_role introuvable');
  writeFileSync(uatEnvPath, readFileSync(uatEnvPath, 'utf8').replace(/\s*$/, '\n') + `UAT_SERVICE_ROLE_KEY=${svc}\n`);
}
const rnd = () => randomBytes(24).toString('hex');
const env = {
  PORT: '8200',
  SUPABASE_URL: uat.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: uat.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_KEY: svc,
  UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:8210',
  UPSTASH_REDIS_REST_TOKEN: 'uat-fake-upstash-token',
  ANTHROPIC_API_KEY: 'sk-ant-fake-uat',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:8211/v1',
  OPENAI_API_KEY: 'sk-fake-uat',
  RESEND_API_KEY: '',
  EMAIL_FROM: 'uat@uat.ziko.test',
  GITHUB_TOKEN: '',
  GITHUB_REPO: '',
  EXPO_ACCESS_TOKEN: '',
  APP_ORIGIN: 'http://localhost:8200',
  CRON_SECRET: rnd(),
  WEBHOOK_SECRET: rnd(),
  EMAIL_VERIFY_RPC_SECRET: rnd(),
};
writeFileSync(outPath, '# UAT local - branche uat-v1-20 UNIQUEMENT. Genere par scripts/uat/make-backend-env.mjs. NE PAS COMMITTER.\n' + Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
console.log(`ecrit ${outPath} (${Object.keys(env).length} variables, cles non affichees)`);
