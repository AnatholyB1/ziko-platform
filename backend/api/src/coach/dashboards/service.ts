import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { streamText, stepCountIs } from 'ai'
import { authMiddleware } from '../../middleware/auth.js'
import { creditCheck, creditDeduct } from '../../middleware/creditGate.js'
import { getOrCreateConversation, appendMessages } from '../../context/conversation.js'
import { AGENT_MODEL } from '../../config/models.js'
import { getDashboardConfig, upsertDashboardConfig, deleteDashboardConfig, getCoachMemory, upsertCoachMemory } from './db.js'
import { WidgetSchema, DEFAULT_WIDGETS } from './schemas.js'
import { buildDashboardSDKTools } from './tools.js'
import type { Widget } from './types.js'

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
