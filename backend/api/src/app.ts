import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { handle } from 'hono/vercel';
import { z } from 'zod';
import { aiRouter } from './routes/ai.js';
import { pluginsRouter } from './routes/plugins.js';
import { webhooksRouter } from './routes/webhooks.js';
import { bugsRouter } from './routes/bugs.js';
import { supplementsRouter } from './routes/supplements.js';
import { pantryRecipesRouter } from './routes/pantry-recipes.js';
import { ipRateLimiter } from './middleware/rateLimiter.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow Expo dev tools, production app, and localhost (D-01, D-02, D-03)
      const allowed: (string | RegExp)[] = [
        /^exp:\/\//,
        /^https?:\/\/localhost/,
      ];
      if (process.env.APP_ORIGIN) {
        allowed.push(process.env.APP_ORIGIN);
      }
      return allowed.some((p) =>
        typeof p === 'string' ? p === origin : p.test(origin),
      )
        ? origin
        : null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);
app.use('*', secureHeaders()); // SEC-02: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS
app.use('*', ipRateLimiter); // D-01: 200 req/60s per IP

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.route('/ai', aiRouter);
app.route('/plugins', pluginsRouter);
app.route('/webhooks', webhooksRouter);
app.route('/bugs', bugsRouter);
app.route('/supplements', supplementsRouter);
app.route('/pantry', pantryRecipesRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    return c.json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path, message: i.message })),
    }, 400);
  }
  console.error('[API Error]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;

// Vercel serverless handlers
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
