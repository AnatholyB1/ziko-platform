/**
 * STORAGE-04 backend child: drives the real Hono app in-process with real user JWTs.
 *
 * Spawned by 10-storage-auth-tests.mjs with SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY /
 * SUPABASE_SERVICE_KEY of the TARGET project and ZIKO_STORAGE_LIVE_FIXTURE (gitignored .tmp file).
 * Prints exactly one JSON object ({ results: [{ id, status, route? }] }) on stdout. Never prints tokens.
 *
 * Carried coach routes (06-09): the table-name codemod is in the tree, so the 6 routes that were deferred in
 * Phase 5 run for real against fixture rows the orchestrator inserted (fixture.route: videoId,
 * annotationId, exerciseId, plus an active coach C -> athlete A link). Handlers return 200/201 for
 * allowed calls and 403 for foreign callers, except GET /coach/exercises/:id/media-url which degrades
 * to 200 with all-null URLs for an unlinked caller; that shape is mapped to 'deny' here.
 *
 * `--selfcheck` imports the app with dummy env and exits 0 without any network access.
 */
import { readFileSync } from 'node:fs';

type Status = 'allow' | 'deny' | 'reject' | 'error';
interface Result {
  id: string;
  status: Status;
  route?: string;
}

function statusFromHttp(code: number): Status {
  if (code === 200 || code === 201) return 'allow';
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
    route: { videoId: string; annotationId: string; exerciseId: string };
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

  type Check = (body: any) => boolean;
  async function call(
    id: string,
    route: string,
    actor: 'A' | 'B' | 'C' | 'D',
    method: 'GET' | 'POST',
    url: string,
    jsonBody: unknown,
    check: Check,
    denyWhenNullBody?: (body: any) => boolean,
  ) {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${fixture.users[actor].jwt}` };
      if (jsonBody !== undefined) headers['Content-Type'] = 'application/json';
      const res = await app.request(url, {
        method,
        headers,
        body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
      });
      let status = statusFromHttp(res.status);
      if (status === 'allow') {
        const body = await res.json();
        if (denyWhenNullBody?.(body)) status = 'deny';
        else if (!check(body)) status = 'error';
      }
      results.push({ id, status, route });
    } catch {
      results.push({ id, status: 'error', route });
    }
  }

  const { videoId, annotationId, exerciseId } = fixture.route;
  const hasUrl: Check = (b) => typeof b?.signedUrl === 'string' && b.signedUrl.length > 0;
  const allNullMedia = (b: any) => !b?.video_url && !b?.photo_url && !b?.gif_url;

  await call('bk-clients-links-me', 'GET /coach/clients/links/me', 'A', 'GET', '/coach/clients/links/me', undefined,
    (b) => b?.link?.coach_id === fixture.users.C.id && b?.link?.client_id === fixture.users.A.id);
  await call('bk-videos-upload-url', 'POST /coach/videos/upload-url', 'A', 'POST', '/coach/videos/upload-url', {},
    (b) => hasUrl(b) && typeof b.videoId === 'string');
  await call('bk-videos-signed-url', 'GET /coach/videos/:videoId/signed-url', 'C', 'GET', `/coach/videos/${videoId}/signed-url`, undefined, hasUrl);
  await call('bk-videos-signed-url-foreign', 'GET /coach/videos/:videoId/signed-url', 'D', 'GET', `/coach/videos/${videoId}/signed-url`, undefined, hasUrl);
  await call('bk-videos-audio-url', 'GET /coach/videos/annotations/:annotationId/audio-url', 'C', 'GET', `/coach/videos/annotations/${annotationId}/audio-url`, undefined, hasUrl);
  await call('bk-videos-audio-url-foreign', 'GET /coach/videos/annotations/:annotationId/audio-url', 'D', 'GET', `/coach/videos/annotations/${annotationId}/audio-url`, undefined, hasUrl);
  await call('bk-exercises-media-url', 'GET /coach/exercises/:id/media-url', 'A', 'GET', `/coach/exercises/${exerciseId}/media-url`, undefined,
    (b) => !allNullMedia(b), allNullMedia);
  await call('bk-exercises-media-url-foreign-athlete', 'GET /coach/exercises/:id/media-url', 'B', 'GET', `/coach/exercises/${exerciseId}/media-url`, undefined,
    () => true, allNullMedia);
  await call('bk-exercises-media-url-foreign-coach', 'GET /coach/exercises/:id/media-url', 'D', 'GET', `/coach/exercises/${exerciseId}/media-url`, undefined,
    () => true, allNullMedia);
  await call('bk-imports-create', 'POST /coach/imports', 'C', 'POST', '/coach/imports',
    { filename: 'storage-test.pdf', mime_type: 'application/pdf', size_bytes: 1024, mode: 'coach_template' },
    (b) => typeof b?.import_id === 'string' && typeof b?.signed_upload_url === 'string');

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
