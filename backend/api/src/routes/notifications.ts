import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

// Admin client — bypasses RLS for token upsert/deactivation
// SUPABASE_SERVICE_KEY is required (server-side only, never sent to mobile)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const notificationsRouter = new Hono();

// All routes require a valid Supabase JWT
notificationsRouter.use('*', authMiddleware);

/**
 * POST /notifications/token
 * Register or refresh a push token for the authenticated user's device.
 *
 * Body: { token: string, platform: 'ios' | 'android', deviceId: string }
 * Returns: 200 { registered: true }
 */
notificationsRouter.post('/token', async (c) => {
  const { userId } = c.get('auth');
  const body = await c.req.json<{
    token: string;
    platform: string;
    deviceId: string;
  }>();

  const { token, platform, deviceId } = body ?? {};

  // Validate token format — must be ExponentPushToken[...]
  const EXPO_TOKEN_REGEX = /^ExponentPushToken\[.+\]$/;
  if (!token || !EXPO_TOKEN_REGEX.test(token)) {
    return c.json({ error: 'Invalid push token format' }, 400);
  }

  if (!platform || !['ios', 'android'].includes(platform)) {
    return c.json({ error: 'Invalid platform — must be ios or android' }, 400);
  }

  if (!deviceId) {
    return c.json({ error: 'deviceId is required' }, 400);
  }

  // UPSERT: register or refresh token on conflict (user_id, device_id)
  const { error } = await supabaseAdmin.from('notification_tokens').upsert(
    {
      user_id: userId,
      device_id: deviceId,
      token,
      platform,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,device_id',
    },
  );

  if (error) {
    console.error('[notifications/token] upsert error:', error);
    return c.json({ error: 'Failed to register token' }, 500);
  }

  return c.json({ registered: true });
});

/**
 * DELETE /notifications/token/:deviceId
 * Soft-deactivate push token on logout or permission revocation.
 *
 * Returns: 200 { unregistered: true }
 */
notificationsRouter.delete('/token/:deviceId', async (c) => {
  const { userId } = c.get('auth');
  const deviceId = c.req.param('deviceId');

  const { error } = await supabaseAdmin
    .from('notification_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('device_id', deviceId);

  if (error) {
    console.error('[notifications/token] deactivate error:', error);
    return c.json({ error: 'Failed to unregister token' }, 500);
  }

  return c.json({ unregistered: true });
});
