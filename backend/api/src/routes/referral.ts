import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const router = new Hono();

// All routes require auth
router.use('*', authMiddleware);

// ── GET /referral — fetch code + invite stats ─────────────────
router.get('/', async (c) => {
  const { userId } = c.get('auth');

  // Fetch referral code, generate via RPC if null
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('referral_code')
    .eq('id', userId)
    .single();

  if (profileError) {
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }

  let code = (profile as any)?.referral_code as string | null;

  if (!code) {
    // Generate via function call
    const { data: generated, error: genError } = await supabase
      .rpc('generate_referral_code', { user_id: userId });

    if (!genError && generated) {
      code = generated as string;
      await supabase
        .from('user_profiles')
        .update({ referral_code: code })
        .eq('id', userId);
    }
  }

  // Count invites grouped by status
  const { data: invites } = await supabase
    .from('app_invites')
    .select('status')
    .eq('inviter_id', userId);

  const counts = { pending: 0, accepted: 0, reward_pending: 0, rewarded: 0 };
  for (const inv of (invites ?? []) as { status: string }[]) {
    const s = inv.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  const total_accepted = counts.accepted + counts.reward_pending + counts.rewarded;

  return c.json({
    code: code ?? null,
    invites: counts,
    total_accepted,
  });
});

// ── POST /referral/redeem — use someone's referral code ───────
router.post('/redeem', async (c) => {
  const { userId } = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'code is required' }, 400);
  }

  const normalizedCode = code.trim().toUpperCase();

  // Look up the code owner
  const { data: owner, error: ownerError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('referral_code', normalizedCode)
    .single();

  if (ownerError || !owner) {
    return c.json({ error: 'Code invalide ou inexistant.' }, 404);
  }

  const ownerId = (owner as any).id as string;

  // Cannot use own code
  if (ownerId === userId) {
    return c.json({ error: 'Tu ne peux pas utiliser ton propre code.' }, 400);
  }

  // Check if current user has already used a referral code
  const { data: currentUser } = await supabase
    .from('user_profiles')
    .select('used_referral_code')
    .eq('id', userId)
    .single();

  if ((currentUser as any)?.used_referral_code === true) {
    return c.json({ error: 'Tu as déjà utilisé un code de parrainage.' }, 400);
  }

  // Insert invite record with reward_pending status
  const { error: insertError } = await supabase
    .from('app_invites')
    .insert({
      inviter_id: ownerId,
      invite_code: normalizedCode,
      used_by: userId,
      status: 'reward_pending',
    });

  if (insertError) {
    console.error('[referral/redeem] insert error:', insertError);
    return c.json({ error: 'Erreur lors de l\'enregistrement du parrainage.' }, 500);
  }

  // Mark current user as having used a referral code
  await supabase
    .from('user_profiles')
    .update({ used_referral_code: true })
    .eq('id', userId);

  return c.json({
    ok: true,
    message: 'Récompense en attente — notre équipe valide et crédite sous 48h',
  });
});

// ── POST /promo/validate — check a promo code ─────────────────
router.post('/promo/validate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  if (!code || typeof code !== 'string') {
    return c.json({ valid: false });
  }

  const { data: promo } = await supabase
    .from('promo_codes')
    .select('id, description, discount_pct, max_uses, uses_count, expires_at, is_active')
    .eq('code', code.trim().toUpperCase())
    .single();

  if (!promo) {
    return c.json({ valid: false });
  }

  const p = promo as any;

  if (!p.is_active) {
    return c.json({ valid: false });
  }

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    return c.json({ valid: false });
  }

  if (p.max_uses !== null && p.uses_count >= p.max_uses) {
    return c.json({ valid: false });
  }

  return c.json({
    valid: true,
    description: p.description ?? null,
    discount_pct: p.discount_pct ?? null,
  });
});

// ── POST /promo/apply — redeem a promo code ───────────────────
router.post('/promo/apply', async (c) => {
  const { userId } = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'code is required' }, 400);
  }

  const normalizedCode = code.trim().toUpperCase();

  // Re-validate
  const { data: promo } = await supabase
    .from('promo_codes')
    .select('id, discount_pct, max_uses, uses_count, expires_at, is_active')
    .eq('code', normalizedCode)
    .single();

  if (!promo) {
    return c.json({ error: 'Code invalide.' }, 404);
  }

  const p = promo as any;

  if (!p.is_active) {
    return c.json({ error: 'Ce code n\'est plus actif.' }, 400);
  }

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    return c.json({ error: 'Ce code a expiré.' }, 400);
  }

  if (p.max_uses !== null && p.uses_count >= p.max_uses) {
    return c.json({ error: 'Ce code a atteint son nombre maximum d\'utilisations.' }, 400);
  }

  // Check if user already redeemed this promo
  const { data: existingRedemption } = await supabase
    .from('user_promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_id', p.id)
    .single();

  if (existingRedemption) {
    return c.json({ error: 'Tu as déjà utilisé ce code promo.' }, 400);
  }

  // Insert redemption record
  const { error: redemptionError } = await supabase
    .from('user_promo_redemptions')
    .insert({ user_id: userId, promo_id: p.id });

  if (redemptionError) {
    console.error('[promo/apply] redemption insert error:', redemptionError);
    return c.json({ error: 'Erreur lors de l\'application du code.' }, 500);
  }

  // Increment uses_count
  await supabase
    .from('promo_codes')
    .update({ uses_count: p.uses_count + 1 })
    .eq('id', p.id);

  return c.json({ ok: true, discount_pct: p.discount_pct ?? null });
});

export { router as referralRoutes };
