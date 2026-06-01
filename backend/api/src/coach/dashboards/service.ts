import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { streamText, stepCountIs, generateText } from 'ai'
import { authMiddleware } from '../../middleware/auth.js'
import { creditCheck, creditDeduct } from '../../middleware/creditGate.js'
import { getOrCreateConversation, appendMessages } from '../../context/conversation.js'
import { AGENT_MODEL } from '../../config/models.js'
import { getDashboardConfig, upsertDashboardConfig, deleteDashboardConfig, getCoachMemory, upsertCoachMemory, createUserClient } from './db.js'
import { WidgetSchema, DEFAULT_WIDGETS } from './schemas.js'
import { buildDashboardSDKTools } from './tools.js'
import type { Widget, CoachMemoryTemplate, CoachMemoryPreferences } from './types.js'
import type { InsightsResponse, ThresholdAlert, CoachMetricThreshold } from '../ai/types.js'

export const dashboardsRouter = new Hono()
dashboardsRouter.use('*', authMiddleware)

// L-05: /memory routes MUST be registered before /:clientId to prevent
// Hono from treating the literal string "memory" as a clientId param.
dashboardsRouter.get('/memory', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const row = await getCoachMemory(jwt, userId)
    if (!row) return c.json({ preferences: {}, templates: [], recent_actions: [] })
    return c.json({
      preferences: row.memory.preferences ?? {},
      templates: row.memory.templates ?? [],
      recent_actions: (row.memory as any).recent_actions ?? [],
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

dashboardsRouter.put('/memory', async (c) => {
  try {
    const { userId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const body = await c.req.json() as {
      templates?: CoachMemoryTemplate[]
      preferences?: CoachMemoryPreferences
      recent_actions?: string[]
    }

    // Load existing memory to deep-merge
    const existingRow = await getCoachMemory(jwt, userId)
    const existing = existingRow?.memory ?? { templates: [], preferences: {}, recent_actions: [] }

    // 409 duplicate name check: reject if body adds a template whose name already exists
    // (detected by: new id not in existing ids, but name matches an existing name)
    if (body.templates) {
      const existingIds = new Set((existing.templates ?? []).map((t: CoachMemoryTemplate) => t.id))
      const existingNames = new Set((existing.templates ?? []).map((t: CoachMemoryTemplate) => t.name))
      const duplicateNameEntry = body.templates.find(
        (t) => !existingIds.has(t.id) && existingNames.has(t.name),
      )
      if (duplicateNameEntry) {
        return c.json({ error: 'Template name already exists' }, 409)
      }
    }

    // Deep-merge: apply only the partial fields provided in body
    const merged = {
      preferences: body.preferences !== undefined
        ? { ...existing.preferences, ...body.preferences }
        : existing.preferences ?? {},
      templates: body.templates !== undefined ? body.templates : existing.templates ?? [],
      recent_actions: body.recent_actions !== undefined
        ? body.recent_actions
        : (existing as any).recent_actions ?? [],
    }

    await upsertCoachMemory(jwt, userId, merged)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInsightsPrompt(sport: string, period: string, chartData: Record<string, unknown>): string {
  const chartKeys = Object.keys(chartData).join(', ')
  return `Tu es un assistant coach sportif expert. Analyse les données du tableau de bord suivant et génère des insights concis et actionnables.

Sport: ${sport}
Période: ${period}

Données des graphiques:
${JSON.stringify(chartData, null, 2)}

Réponds UNIQUEMENT avec du JSON valide dans ce format exact:
{
  "chartInsights": {
    "<chart_key>": "<insight en une ligne, max 80 caractères>"
  },
  "narrative": "<un paragraphe de synthèse, max 200 caractères>"
}

Clés de graphiques disponibles: ${chartKeys}
Langue: français, concis et actionnable.`
}

// ─── POST /:clientId/insights — Batch AI insights endpoint (D-06/D-07/D-13) ─
// Generates per-chart insight chips, a narrative summary, and evaluates threshold
// crossings in a single Claude round-trip. Must be registered before GET /:clientId
// to avoid Hono route-param shadowing (L-05 pattern).
dashboardsRouter.post(
  '/:clientId/insights',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => {
    try {
      const coachId = c.get('auth').userId
      const jwt = c.req.header('Authorization')!.slice(7)
      const clientId = c.req.param('clientId')

      const body = await c.req.json<{
        sport: string
        period: string
        chartData: Record<string, unknown>
      }>()

      const db = createUserClient(jwt)

      // Fetch active thresholds for this coach/client/sport
      const { data: thresholds, error: thresholdError } = await db
        .from('coach_metric_thresholds')
        .select('*')
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .eq('sport_type', body.sport)
        .eq('is_active', true)

      if (thresholdError) throw new Error(thresholdError.message)

      // Single AI round-trip: generate chartInsights + narrative
      const { text } = await generateText({
        model: AGENT_MODEL,
        messages: [{ role: 'user', content: buildInsightsPrompt(body.sport, body.period, body.chartData) }],
      })

      // Strip markdown fences if Claude wraps the response
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()

      let parsed: { chartInsights: Record<string, string>; narrative: string }
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        parsed = { chartInsights: {}, narrative: '' }
      }

      // Evaluate threshold crossings inline
      const crossedThresholds: ThresholdAlert[] = []
      if (thresholds) {
        for (const t of thresholds as CoachMetricThreshold[]) {
          const currentVal = body.chartData[t.metric_key]
          if (typeof currentVal === 'number') {
            const crossed = t.operator === '>' ? currentVal > t.threshold_value : currentVal < t.threshold_value
            if (crossed) {
              crossedThresholds.push({
                metric_key: t.metric_key,
                operator: t.operator,
                threshold_value: t.threshold_value,
                current_value: currentVal,
              })
            }
          }
        }
      }

      return c.json({ ...parsed, crossedThresholds } satisfies InsightsResponse)
    } catch (err: any) {
      return c.json({ error: err.message }, 500)
    }
  },
)

// ─── GET /:clientId/thresholds — List thresholds for a client (D-11) ─────────
dashboardsRouter.get('/:clientId/thresholds', async (c) => {
  try {
    const coachId = c.get('auth').userId
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')
    const sport = c.req.query('sport')

    const db = createUserClient(jwt)
    let query = db
      .from('coach_metric_thresholds')
      .select('*')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)

    if (sport) {
      query = query.eq('sport_type', sport)
    }

    const { data, error } = await query
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ thresholds: data ?? [] })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── POST /:clientId/thresholds — Create a threshold (D-11/D-12) ─────────────
dashboardsRouter.post('/:clientId/thresholds', async (c) => {
  try {
    const coachId = c.get('auth').userId
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')

    const body = await c.req.json<Omit<CoachMetricThreshold, 'id' | 'coach_id' | 'client_id' | 'created_at' | 'updated_at'>>()

    if (body.operator !== '>' && body.operator !== '<') {
      return c.json({ error: 'operator must be > or <' }, 400)
    }
    if (typeof body.threshold_value !== 'number') {
      return c.json({ error: 'threshold_value must be numeric' }, 400)
    }

    const db = createUserClient(jwt)
    const { data, error } = await db
      .from('coach_metric_thresholds')
      .insert({ ...body, coach_id: coachId, client_id: clientId })
      .select('*')
      .single()

    if (error) return c.json({ error: error.message }, 400)
    return c.json({ threshold: data })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// ─── DELETE /:clientId/thresholds/:thresholdId — Remove a threshold (D-12) ───
dashboardsRouter.delete('/:clientId/thresholds/:thresholdId', async (c) => {
  try {
    const coachId = c.get('auth').userId
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')
    const thresholdId = c.req.param('thresholdId')

    const db = createUserClient(jwt)
    const { error } = await db
      .from('coach_metric_thresholds')
      .delete()
      .eq('id', thresholdId)
      .eq('coach_id', coachId)
      .eq('client_id', clientId)

    if (error) return c.json({ error: error.message }, 500)
    return c.json({ deleted: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
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

// ─── POST /:clientId/ai-edit — SSE streaming dashboard edit session ───────────
// D-03: streamText + onStepFinish emits tool_result events atomically.
// D-07: Stateless per-request — currentWidgets arrives in the request body.
// D-15: System prompt scoped to dashboard tools only (no coaching tools).
// D-17: creditCheck + creditDeduct at coach_chat rate.
dashboardsRouter.post(
  '/:clientId/ai-edit',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => {
    const clientId = c.req.param('clientId')
    const auth = c.get('auth')
    const coachId = auth.userId
    const jwt = c.req.header('Authorization')!.slice(7)

    const body = await c.req.json<{
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      currentWidgets: Widget[]
      conversation_id?: string
    }>()

    const { messages = [], currentWidgets = [], conversation_id: bodyConversationId } = body

    // Load or create conversation for multi-turn history persistence
    const convo = await getOrCreateConversation(coachId, bodyConversationId, jwt)

    // Prepend persisted history so multi-turn context is available
    const allMessages = [
      ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ...messages,
    ]

    // D-07: Each request gets its own tool factory capturing the current pending widget state
    const tools = buildDashboardSDKTools(currentWidgets)

    // Capture stream writer reference so onStepFinish can write tool_result events
    // into the SSE stream. Assigned inside the stream() callback before streaming begins.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let streamWriter: any = null

    // PITFALLS #13: stepCountIs(2) — not 5 (one tool call + one confirmation per turn)
    const result = streamText({
      model: AGENT_MODEL,
      // D-15: System prompt strictly scoped to dashboard tools only (EDIT-05)
      system:
        'You are a dashboard configuration assistant. You may only call add_widget, update_widget, remove_widget, or reorder_widgets to modify the dashboard layout. For coaching questions, ask the coach to close the editor first. Always act on dashboard requests immediately with the best interpretation, then confirm what you did. Never ask clarifying questions before acting on an unambiguous layout request. Respond in the same language as the coach (French or English).',
      messages: allMessages,
      tools,
      stopWhen: stepCountIs(2),
      onStepFinish: async ({ toolResults }) => {
        // PITFALLS #3: tool results emitted only in onStepFinish (atomic) — never from streamed text
        if (toolResults && toolResults.length > 0 && streamWriter) {
          for (const result of toolResults) {
            const widgets = (result.output as any)?.widgets
            if (widgets !== undefined) {
              await streamWriter.write(
                `data: ${JSON.stringify({ type: 'tool_result', widgets })}\n\n`,
              )
            }
          }
        }
      },
    })

    // SSE headers MUST be set BEFORE stream() call
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    return stream(c, async (s) => {
      // Assign writer so onStepFinish can access it
      streamWriter = s

      try {
        // Send conversation_id first so client can resume across turns
        await s.write(
          `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
        )

        for await (const part of result.fullStream) {
          if (part.type === 'tool-error') {
            const err = (part as any).error
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[DashboardAI tool-error] ${(part as any).toolName}: ${msg}`)
          }
          if (part.type === 'text-delta') {
            const text = (part as any).textDelta ?? (part as any).text ?? ''
            if (text) {
              await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`)
            }
          }
        }

        await s.write('data: [DONE]\n\n')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        console.error('[DashboardAI Stream Error]', err)
        await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`)
        await s.write('data: [DONE]\n\n')
      } finally {
        // PITFALLS #2: appendMessages MUST be called after every turn — missing this breaks multi-turn tool calls
        // Use result.response to get the full message array including tool call turns
        try {
          const response = await result.response
          if (response.messages && response.messages.length > 0) {
            const toSave = response.messages
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
              }))
            // Also persist the incoming user messages that haven't been saved yet
            const userMsgs = messages
              .filter((m) => m.role === 'user')
              .map((m) => ({ role: 'user' as const, content: m.content }))
            await appendMessages(convo.conversationId, [...userMsgs, ...toSave], jwt)
          }
        } catch (appendErr) {
          console.error('[DashboardAI] appendMessages failed:', appendErr)
        }
      }
    })
  },
)
