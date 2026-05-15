// PHASE 23 PRO PROBE — DELETE IN PHASE 24
// D-15: Hono equivalent of apps/web/src/app/api/_debug/limits/route.ts
// Vercel function uses `export const config = { maxDuration: 60 }` in Hono via @hono/vercel.
import { Hono } from 'hono';

const debugRoute = new Hono();

debugRoute.get('/limits', async (c) => {
  if (process.env.DEBUG_LIMITS !== 'on') {
    return c.notFound();
  }
  await new Promise((r) => setTimeout(r, 30_000));
  return c.json({ ok: true, tier: 'pro-confirmed', durationSec: 30 });
});

export default debugRoute;

// Vercel function config for @hono/vercel (Pro tier required for maxDuration > 10s)
export const config = {
  maxDuration: 60,
};
