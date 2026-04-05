import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_BUCKETS = ['profile-photos', 'scan-photos', 'exports'] as const;
type AllowedBucket = typeof ALLOWED_BUCKETS[number];

// ── User-facing storage router (requires JWT auth) ────────
const storageRouter = new Hono();
storageRouter.use('*', authMiddleware);

/** POST /storage/upload-url — generate a signed upload URL for an allowed bucket */
storageRouter.post('/upload-url', async (c) => {
  const auth = c.get('auth' as never) as { userId: string };
  const { bucket, path } = await c.req.json<{ bucket: AllowedBucket; path: string }>();

  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return c.json({ error: 'Invalid bucket' }, 400);
  }

  const fullPath = `${auth.userId}/${path}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(fullPath);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ url: data.signedUrl, token: data.token, path: fullPath });
});

// ── Cron storage cleanup router (CRON_SECRET auth, no JWT) ─
const storageCleanupRouter = new Hono();

const SCAN_PHOTOS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const EXPORTS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;       // 7 days

async function cleanupBucket(
  bucketName: string,
  retentionMs: number,
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];

  // List top-level folders (user ID prefixes)
  const { data: folders, error: listError } = await supabase.storage
    .from(bucketName)
    .list('', { limit: 1000 });

  if (listError || !folders) {
    return {
      deleted: 0,
      errors: [`Failed to list root of ${bucketName}: ${listError?.message ?? 'no data'}`],
    };
  }

  const cutoff = new Date(Date.now() - retentionMs);

  // Enumerate files per folder with fault tolerance
  const folderResults = await Promise.allSettled(
    folders.map(async (folder) => {
      const { data: files, error: folderError } = await supabase.storage
        .from(bucketName)
        .list(folder.name, { limit: 1000 });

      if (folderError || !files) {
        throw new Error(
          `Failed to list ${bucketName}/${folder.name}: ${folderError?.message ?? 'no data'}`,
        );
      }

      const expiredFiles = files.filter(
        (file) => file.created_at && new Date(file.created_at) < cutoff,
      );

      return expiredFiles.map((file) => `${folder.name}/${file.name}`);
    }),
  );

  const expiredPaths: string[] = [];
  for (const result of folderResults) {
    if (result.status === 'fulfilled') {
      expiredPaths.push(...result.value);
    } else {
      errors.push(String(result.reason));
    }
  }

  if (expiredPaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(bucketName)
      .remove(expiredPaths);

    if (removeError) {
      errors.push(`Failed to delete from ${bucketName}: ${removeError.message}`);
      return { deleted: 0, errors };
    }
  }

  return { deleted: expiredPaths.length, errors };
}

/** POST /storage/cron/cleanup — purge stale objects (scan-photos >90d, exports >7d) */
storageCleanupRouter.post('/cron/cleanup', async (c) => {
  // Verify cron secret (Vercel sends CRON_SECRET as bearer token)
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const scanResult = await cleanupBucket('scan-photos', SCAN_PHOTOS_RETENTION_MS);
    const exportsResult = await cleanupBucket('exports', EXPORTS_RETENTION_MS);
    const allErrors = [...scanResult.errors, ...exportsResult.errors];

    if (allErrors.length > 0) {
      console.warn('[Cron] Cleanup partial errors:', allErrors);
    }

    return c.json({
      success: true,
      deleted: {
        scan_photos: scanResult.deleted,
        exports: exportsResult.deleted,
      },
      errors: allErrors,
    });
  } catch (err: any) {
    console.error('[Cron] Cleanup critical error:', err);
    return c.json({ error: err.message }, 500);
  }
});

export { storageRouter, storageCleanupRouter };
