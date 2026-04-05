import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handle } from 'hono/vercel';
import { secureHeaders } from 'hono/secure-headers';
import { ipRateLimiter } from './middleware/rateLimiter.js';
import { z } from 'zod';
import { aiRouter } from './routes/ai.js';
import { pluginsRouter } from './routes/plugins.js';
import { webhooksRouter } from './routes/webhooks.js';
import { bugsRouter } from './routes/bugs.js';
import { supplementsRouter } from './routes/supplements.js';
import { pantryRecipesRouter } from './routes/pantry-recipes.js';
import { storageRouter, storageCleanupRouter } from './routes/storage.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
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
app.use('*', secureHeaders());
app.use('*', ipRateLimiter);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.route('/ai', aiRouter);
app.route('/plugins', pluginsRouter);
app.route('/webhooks', webhooksRouter);
app.route('/bugs', bugsRouter);
app.route('/supplements', supplementsRouter);
app.route('/pantry', pantryRecipesRouter);
app.route('/storage', storageRouter);
app.route('/storage', storageCleanupRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    return c.json({ error: 'Validation error', details: err.issues }, 400);
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
