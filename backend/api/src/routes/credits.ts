import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import * as creditService from '../services/creditService.js';
import { DAILY_EARN_CAP } from '../config/credits.js';

const router = new Hono();

// CRITICAL: auth required — Pitfall 4 from RESEARCH.md
router.use('*', authMiddleware);

// SC-1: GET /credits/balance → { balance, daily_earned, daily_cap, reset_timestamp }
router.get('/balance', async (c) => {
  const { userId } = c.get('auth');
  const summary = await creditService.getBalanceSummary(userId);

  // reset_timestamp = next UTC midnight (Open Question 2 from RESEARCH.md: always next midnight)
  const now = new Date();
  const resetTs = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
  )).toISOString();

  return c.json({
    balance: summary.balance,
    daily_earned: summary.dailyEarned,
    daily_cap: DAILY_EARN_CAP,
    reset_timestamp: resetTs,
  });
});

// EARN-01..06: POST /credits/earn — mobile-side earn path (D-06)
router.post('/earn', async (c) => {
  const { userId } = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const { source, idempotency_key } = body as { source?: string; idempotency_key?: string };

  if (!source || !idempotency_key) {
    return c.json({ credited: false }, 200); // Per D-06: always 200, silent failure
  }

  const VALID_SOURCES = ['workout', 'habit', 'meal', 'measurement', 'stretch', 'cardio'];
  if (!VALID_SOURCES.includes(source)) {
    return c.json({ credited: false }, 200);
  }

  const result = await creditService.earnCredits(userId, source, idempotency_key);
  return c.json({ credited: result.credited });
});

export { router as creditsRouter };
