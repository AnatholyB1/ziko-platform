import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { aiRouter } from './routes/ai.js';
import { pluginsRouter } from './routes/plugins.js';
import { webhooksRouter } from './routes/webhooks.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow Expo dev tools, production app, and localhost
      const allowed = [
        /^exp:\/\//,
        /^https?:\/\/localhost/,
        process.env.APP_ORIGIN ?? '',
      ];
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

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.route('/ai', aiRouter);
app.route('/plugins', pluginsRouter);
app.route('/webhooks', webhooksRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT ?? '3000', 10);
console.log(`🚀 Ziko API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
