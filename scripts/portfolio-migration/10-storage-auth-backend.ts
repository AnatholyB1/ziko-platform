/**
 * STORAGE-04 backend child: drives the real Hono app in-process with real user JWTs.
 *
 * Spawned by 10-storage-auth-tests.mjs with SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY /
 * SUPABASE_SERVICE_KEY of the TARGET project and ZIKO_STORAGE_LIVE_FIXTURE (gitignored .tmp file).
 * Prints exactly one JSON object ({ results: [{ id, status, route? }] }) on stdout. Never prints tokens.
 *
 * Coach storage-signing code paths (verified by reading the source in plan 05-07):
 *   - coach/clients/db.ts signCoachPhoto is not exported and is only reached through listCoachClients /
 *     getActiveLink, which query coach_client_links / coach_profiles.
 *   - coach/videos/service.ts upload-url calls getActiveCoachForAthlete (table query); signed-url and
 *     audio-url load coach_videos / annotation rows first.
 *   - coach/exercises/db.ts getMediaUrls queries coach_exercises + coach_client_links before signing.
 *   - coach/imports/service.ts POST / inserts an ai_imports row before signing.
 * The code still names unprefixed tables (the table-name codemod is not part of Phase 5), so none of
 * these can run against scratch/portfolio yet: they are reported as deferred-table-codemod and become
 * named Phase 6 smoke items. They are never reported as pass.
 *
 * `--selfcheck` imports the app with dummy env and exits 0 without any network access.
 */
import { readFileSync } from 'node:fs';

type Status = 'allow' | 'deny' | 'reject' | 'error' | 'deferred-table-codemod';
interface Result {
  id: string;
  status: Status;
  route?: string;
}

const DEFERRED: Array<{ id: string; route: string }> = [
  { id: 'bk-clients-links-me', route: 'GET /coach/clients/links/me' },
  { id: 'bk-videos-upload-url', route: 'POST /coach/videos/upload-url' },
  { id: 'bk-videos-signed-url', route: 'GET /coach/videos/:videoId/signed-url' },
  { id: 'bk-videos-audio-url', route: 'GET /coach/videos/annotations/:annotationId/audio-url' },
  { id: 'bk-exercises-media-url', route: 'GET /coach/exercises/:id/media-url' },
  { id: 'bk-imports-create', route: 'POST /coach/imports' },
];

function statusFromHttp(code: number): Status {
  if (code === 200) return 'allow';
  if (code === 401 || code === 403) return 'deny';
  if (code === 400) return 'reject';
  return 'error';
}

async function main(): Promise<void> {
  if (process.argv.includes('--selfcheck')) {
    process.env.SUPABASE_URL ??= 'https://selfcheck.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY ??= 'selfcheck';
    const mod = await import('../../backend/api/src/app.ts');
    if (typeof mod.default?.request !== 'function') throw new Error('app has no request()');
    console.log(JSON.stringify({ selfcheck: 'ok' }));
    return;
  }

  const fixturePath = process.env.ZIKO_STORAGE_LIVE_FIXTURE;
  if (!fixturePath) throw new Error('ZIKO_STORAGE_LIVE_FIXTURE is required');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    users: Record<'A' | 'B' | 'C' | 'D', { id: string; jwt: string }>;
    buckets: Record<string, string>;
  };

  // env (target project) is already set by the orchestrator, import only after that.
  const { default: app } = await import('../../backend/api/src/app.ts');

  const results: Result[] = [];

  async function uploadUrl(id: string, bucketSource: string, actor: 'A' | 'B', folderOwner: 'A' | 'B') {
    const bucket = fixture.buckets[bucketSource];
    const p = `${fixture.users[folderOwner].id}/st-backend.png`;
    try {
      const res = await app.request(
        `/storage/upload-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(p)}`,
        { headers: { Authorization: `Bearer ${fixture.users[actor].jwt}` } },
      );
      let status = statusFromHttp(res.status);
      if (status === 'allow') {
        const body = (await res.json()) as { token?: string; upload_url?: string };
        if (!body.token || !body.upload_url) status = 'error';
      }
      results.push({ id, status });
    } catch {
      results.push({ id, status: 'error' });
    }
  }

  await uploadUrl('sp-backend-own', 'scan-photos', 'A', 'A');
  await uploadUrl('sp-backend-foreign', 'scan-photos', 'B', 'A');
  await uploadUrl('ai-backend-own', 'ai-imports', 'A', 'A');
  await uploadUrl('ai-backend-foreign', 'ai-imports', 'B', 'A');

  for (const d of DEFERRED) results.push({ id: d.id, status: 'deferred-table-codemod', route: d.route });

  process.stdout.write(`${JSON.stringify({ results })}\n`);
}

main().then(
  // flush stdout before exiting (the app may keep timers/handles open)
  () => process.stdout.write('', () => process.exit(0)),
  (err) => {
    process.stderr.write(`backend child failed: ${String(err?.message ?? err).replace(/eyJ[\w.-]+/g, '[jwt]')}\n`);
    process.exit(1);
  },
);
