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

const storageRouter = new Hono();
storageRouter.use('*', authMiddleware);

/** GET /storage/upload-url?bucket=&path= — returns a Supabase signed upload URL (60s TTL) */
storageRouter.get('/upload-url', async (c) => {
  const bucket = c.req.query('bucket');
  const path = c.req.query('path');
  const { userId } = c.get('auth');

  // Validate required params
  if (!bucket || !path) {
    return c.json({ error: 'bucket and path query params are required' }, 400);
  }

  // Validate bucket allowlist (D-12)
  if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return c.json({ error: `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}` }, 400);
  }

  // Validate path prefix ownership (D-13)
  if (!path.startsWith(`${userId}/`)) {
    return c.json({ error: 'Path must start with your user ID' }, 403);
  }

  // Generate signed upload URL (D-14)
  // Note: createSignedUploadUrl TTL is fixed server-side; options only support { upsert }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[Storage] createSignedUploadUrl error:', error);
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }

  // Return upload_url, path, token (D-15)
  return c.json({
    upload_url: data.signedUrl,
    path: data.path,
    token: data.token,
  });
});

export { storageRouter };
