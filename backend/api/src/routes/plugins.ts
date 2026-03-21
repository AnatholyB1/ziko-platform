import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const router = new Hono();
router.use('*', authMiddleware);

/** GET /plugins — list all registry plugins */
router.get('/', async (c) => {
  const { data, error } = await adminClient
    .from('plugins_registry')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ plugins: data });
});

/** POST /plugins/:id/install */
router.post('/:id/install', async (c) => {
  const pluginId = c.req.param('id');
  const auth = c.get('auth');

  // Verify plugin exists
  const { data: plugin, error: pluginErr } = await adminClient
    .from('plugins_registry')
    .select('id, name')
    .eq('id', pluginId)
    .eq('is_active', true)
    .single();

  if (pluginErr || !plugin) return c.json({ error: 'Plugin not found' }, 404);

  const { error } = await adminClient.from('user_plugins').upsert({
    user_id: auth.userId,
    plugin_id: pluginId,
    is_enabled: true,
    installed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,plugin_id' });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, plugin_id: pluginId });
});

/** DELETE /plugins/:id/uninstall */
router.delete('/:id/uninstall', async (c) => {
  const pluginId = c.req.param('id');
  const auth = c.get('auth');

  const { error } = await adminClient
    .from('user_plugins')
    .delete()
    .eq('user_id', auth.userId)
    .eq('plugin_id', pluginId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

/** PATCH /plugins/:id/toggle — enable/disable */
router.patch('/:id/toggle', async (c) => {
  const pluginId = c.req.param('id');
  const auth = c.get('auth');
  const { is_enabled } = await c.req.json<{ is_enabled: boolean }>();

  const { error } = await adminClient
    .from('user_plugins')
    .update({ is_enabled })
    .eq('user_id', auth.userId)
    .eq('plugin_id', pluginId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, is_enabled });
});

export { router as pluginsRouter };
