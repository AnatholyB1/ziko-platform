import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { getDashboardConfig, upsertDashboardConfig, deleteDashboardConfig, getCoachMemory, upsertCoachMemory } from './db.js'
import { WidgetSchema, DEFAULT_WIDGETS } from './schemas.js'

export const dashboardsRouter = new Hono()
dashboardsRouter.use('*', authMiddleware)

// L-05: /memory routes MUST be registered before /:clientId to prevent
// Hono from treating the literal string "memory" as a clientId param.
dashboardsRouter.get('/memory', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const row = await getCoachMemory(jwt, userId)
    if (!row) return c.json({ memory: { templates: [], preferences: {} } })
    return c.json({ memory: row.memory })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

dashboardsRouter.put('/memory', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const body = await c.req.json()
    const row = await upsertCoachMemory(jwt, userId, body.memory)
    return c.json({ memory: row.memory })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

dashboardsRouter.get('/:clientId', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')
    const config = await getDashboardConfig(jwt, userId, clientId)
    return c.json(config)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

dashboardsRouter.put('/:clientId', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')
    const body = await c.req.json()
    const widgets = (body.widgets as unknown[]).map(w => WidgetSchema.parse(w))
    const row = await upsertDashboardConfig(jwt, userId, clientId, widgets)
    return c.json({ schema_version: 1 as const, ...row })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

dashboardsRouter.delete('/:clientId', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')
    await deleteDashboardConfig(jwt, userId, clientId)
    return c.json({ deleted: true, defaults: DEFAULT_WIDGETS })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})
