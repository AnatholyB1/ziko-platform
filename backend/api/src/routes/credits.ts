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

export { router as creditsRouter };
