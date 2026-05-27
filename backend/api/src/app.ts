import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handle } from 'hono/vercel';
import { aiRouter } from './routes/ai.js';
import { pluginsRouter } from './routes/plugins.js';
import { webhooksRouter } from './routes/webhooks.js';
import { bugsRouter } from './routes/bugs.js';
import { supplementsRouter } from './routes/supplements.js';
import { pantryRecipesRouter } from './routes/pantry-recipes.js';
import { creditsRouter } from './routes/credits.js';
import { referralRoutes } from './routes/referral.js';
import { notificationsRouter } from './routes/notifications.js';
import { storageRouter, storageCleanupRouter } from './routes/storage.js';
import { identityRouter } from './coach/identity/service.js';
import { invitationsRouter } from './coach/invitations/service.js';
import { clientsRouter } from './coach/clients/service.js';
import { programsRouter } from './coach/programs/service.js';
import { importsRouter } from './coach/imports/service.js';
import { coachAiRouter } from './coach/ai/service.js';
import { voiceRouter } from './coach/voice/service.js';
import { brandingRouter } from './coach/branding/service.js';
import { exercisesRouter } from './coach/exercises/service.js';
import { dashboardsRouter } from './coach/dashboards/service.js';
import { videosRouter } from './coach/videos/service.js';
import { formsRouter, formsCronRouter } from './routes/forms.js';
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
        /^https?:\/\/.*\.vercel\.app$/,
        process.env.APP_ORIGIN ?? '',
      ];
      return allowed.some((p) =>
        typeof p === 'string' ? p === origin : p.test(origin),
      )
        ? origin
        : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.route('/bugs', bugsRouter);
app.route('/supplements', supplementsRouter);
app.route('/pantry', pantryRecipesRouter);
app.route('/credits', creditsRouter);
app.route('/referral', referralRoutes);
app.route('/promo', referralRoutes);
app.route('/notifications', notificationsRouter);
app.route('/storage', storageRouter);
app.route('/storage', storageCleanupRouter);
app.route('/coach/identity', identityRouter);
app.route('/coach/invitations', invitationsRouter);
app.route('/coach/clients', clientsRouter);
app.route('/coach/programs', programsRouter);
app.route('/coach/imports', importsRouter);
app.route('/coach/ai', coachAiRouter);
app.route('/coach/voice', voiceRouter);
app.route('/coach/branding', brandingRouter);
app.route('/coach/exercises', exercisesRouter);
app.route('/coach/dashboards', dashboardsRouter);
app.route('/coach/videos', videosRouter);
app.route('/forms', formsRouter);
app.route('/forms', formsCronRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
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
