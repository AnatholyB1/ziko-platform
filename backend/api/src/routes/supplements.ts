import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const router = new Hono();

// ── Public endpoints (read-only catalog) ─────────────────

/** GET /supplements/categories */
router.get('/categories', async (c) => {
  const { data, error } = await adminClient
    .from('supplement_categories')
    .select('*')
    .order('display_order');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ categories: data });
});

/** GET /supplements/brands */
router.get('/brands', async (c) => {
  const { data, error } = await adminClient
    .from('supplement_brands')
    .select('*')
    .order('name');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ brands: data });
});

/** GET /supplements/search?q=...&category=...&brand=...&limit=50 */
router.get('/search', async (c) => {
  const q = c.req.query('q');
  const category = c.req.query('category');
  const brand = c.req.query('brand');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);

  let query = adminClient
    .from('supplements')
    .select('*, supplement_brands(*), supplement_categories(*)');

  if (q) query = query.ilike('name', `%${q}%`);
  if (category) query = query.eq('category_id', category);
  if (brand) query = query.eq('brand_id', brand);

  const { data, error } = await query.order('name').limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ supplements: data });
});

/** GET /supplements/:id — single supplement with latest prices */
router.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [{ data: supplement, error: suppErr }, { data: prices, error: priceErr }] = await Promise.all([
    adminClient
      .from('supplements')
      .select('*, supplement_brands(*), supplement_categories(*)')
      .eq('id', id)
      .single(),
    adminClient
      .from('supplement_prices')
      .select('*')
      .eq('supplement_id', id)
      .order('price', { ascending: true }),
  ]);

  if (suppErr || !supplement) return c.json({ error: 'Not found' }, 404);
  return c.json({ supplement, prices: prices ?? [] });
});

/** GET /supplements/:id/prices — price history */
router.get('/:id/prices', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await adminClient
    .from('supplement_prices')
    .select('*')
    .eq('supplement_id', id)
    .order('scraped_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ prices: data });
});

// ── Protected endpoints (user actions) ───────────────────

/** GET /supplements/favorites/list — user bookmarks */
router.get('/favorites/list', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const { data, error } = await adminClient
    .from('user_supplement_favorites')
    .select('supplement_id, supplements(*, supplement_brands(*), supplement_categories(*))')
    .eq('user_id', auth.userId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ favorites: data });
});

/** POST /supplements/favorites/:supplementId */
router.post('/favorites/:supplementId', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const supplementId = c.req.param('supplementId');
  const { error } = await adminClient.from('user_supplement_favorites').insert({
    user_id: auth.userId,
    supplement_id: supplementId,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

/** DELETE /supplements/favorites/:supplementId */
router.delete('/favorites/:supplementId', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const supplementId = c.req.param('supplementId');
  const { error } = await adminClient
    .from('user_supplement_favorites')
    .delete()
    .eq('user_id', auth.userId)
    .eq('supplement_id', supplementId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ── Cron endpoint — scrape supplements ───────────────────

/** GET /supplements/cron/scrape — triggered by Vercel Cron daily */
router.get('/cron/scrape', async (c) => {
  // Verify cron secret (Vercel sends CRON_SECRET header)
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { runAllScrapers } = await import('../scrapers/index.js');
    const results = await runAllScrapers(adminClient);
    return c.json({ success: true, results });
  } catch (err: any) {
    console.error('[Cron] Scrape error:', err);
    return c.json({ error: err.message }, 500);
  }
});

export { router as supplementsRouter };
