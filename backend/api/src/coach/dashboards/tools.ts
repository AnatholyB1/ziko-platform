// Dashboard tool handler functions + buildDashboardSDKTools factory.
// Pure mutation helpers operate on a local copy of the widget array — no DB access.
// Used by the /ai-edit SSE endpoint (Plan 03-02).
import { randomUUID } from 'node:crypto'
import { tool, jsonSchema } from 'ai'
import type { Widget } from './types.js'
import { WidgetSchema } from './schemas.js'

// ─── Pure mutation helpers ────────────────────────────────────────────────────

/**
 * Appends a new widget to the array.
 * Generates a UUID if input.id is absent.
 * Validates the full widget via WidgetSchema (T-03-01: Zod .strict() rejects unknown types).
 */
export function applyAddWidget(widgets: Widget[], input: Record<string, unknown>): Widget[] {
  const withId = input.id ? input : { ...input, id: randomUUID() }
  const validated = WidgetSchema.parse(withId) as Widget
  return [...widgets, validated]
}

/**
 * Shallow-merges new config values onto the matching widget.
 * Only the config sub-object is merged — id, type, gridPos are immutable (T-03-02).
 * Throws if the widget id is not found.
 */
export function applyUpdateWidget(
  widgets: Widget[],
  { id, config }: { id: string; config: Record<string, unknown> },
): Widget[] {
  const idx = widgets.findIndex((w) => w.id === id)
  if (idx === -1) throw new Error(`Widget not found: ${id}`)
  const updated = {
    ...widgets[idx],
    config: { ...(widgets[idx] as any).config, ...config },
  } as Widget
  return [...widgets.slice(0, idx), updated, ...widgets.slice(idx + 1)]
}

/**
 * Removes the widget matching id.
 * Idempotent — returns unchanged array if id not found (no throw).
 */
export function applyRemoveWidget(widgets: Widget[], { id }: { id: string }): Widget[] {
  return widgets.filter((w) => w.id !== id)
}

/**
 * Reorders widgets by the explicit ids array.
 * Widgets NOT in the ids list are dropped — ids is the canonical new order.
 */
export function applyReorderWidgets(widgets: Widget[], { ids }: { ids: string[] }): Widget[] {
  return ids.map((id) => widgets.find((w) => w.id === id)).filter(Boolean) as Widget[]
}

// ─── SDK tools factory ────────────────────────────────────────────────────────

/**
 * Returns an object with 4 Vercel AI SDK tool() instances, keyed by tool name.
 * A local widgetsRef captures the latest array state across multi-step tool calls
 * within the same request (stateless per-request, not cross-request).
 */
export function buildDashboardSDKTools(currentWidgets: Widget[]) {
  const widgetsRef = { current: currentWidgets }

  const add_widget = tool({
    description: 'Append a new widget to the dashboard. Returns the updated widget array.',
    inputSchema: jsonSchema<{
      type: 'line_chart' | 'bar_chart' | 'kpi_tile' | 'table' | 'athlete_list' | 'threshold_indicator' | 'callout'
      title: string
      period: '7d' | '30d' | '90d' | 'all'
      gridPos: { x: number; y: number; w: number; h: number }
      config: Record<string, unknown>
    }>({
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['line_chart', 'bar_chart', 'kpi_tile', 'table', 'athlete_list', 'threshold_indicator', 'callout'],
        },
        title: { type: 'string' },
        period: { type: 'string', enum: ['7d', '30d', '90d', 'all'] },
        gridPos: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            w: { type: 'number' },
            h: { type: 'number' },
          },
          required: ['x', 'y', 'w', 'h'],
          additionalProperties: false,
        },
        config: { type: 'object' },
      },
      required: ['type', 'title', 'period', 'gridPos', 'config'],
      additionalProperties: false,
    } as any),
    execute: async (input) => {
      const newWidgets = applyAddWidget(widgetsRef.current, input as Record<string, unknown>)
      widgetsRef.current = newWidgets
      return { widgets: newWidgets }
    },
  })

  const update_widget = tool({
    description:
      'Merge new config values onto an existing widget identified by id. Returns the updated widget array.',
    inputSchema: jsonSchema<{ id: string; config: Record<string, unknown> }>({
      type: 'object',
      properties: {
        id: { type: 'string' },
        config: { type: 'object' },
      },
      required: ['id', 'config'],
      additionalProperties: false,
    } as any),
    execute: async (input) => {
      const newWidgets = applyUpdateWidget(widgetsRef.current, input as { id: string; config: Record<string, unknown> })
      widgetsRef.current = newWidgets
      return { widgets: newWidgets }
    },
  })

  const remove_widget = tool({
    description: 'Remove a widget by id from the dashboard. Returns the updated widget array.',
    inputSchema: jsonSchema<{ id: string }>({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    } as any),
    execute: async (input) => {
      const newWidgets = applyRemoveWidget(widgetsRef.current, input as { id: string })
      widgetsRef.current = newWidgets
      return { widgets: newWidgets }
    },
  })

  const reorder_widgets = tool({
    description:
      'Reorder the dashboard widgets by providing the complete desired order of widget ids. Returns the updated widget array.',
    inputSchema: jsonSchema<{ ids: string[] }>({
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['ids'],
      additionalProperties: false,
    } as any),
    execute: async (input) => {
      const newWidgets = applyReorderWidgets(widgetsRef.current, input as { ids: string[] })
      widgetsRef.current = newWidgets
      return { widgets: newWidgets }
    },
  })

  return { add_widget, update_widget, remove_widget, reorder_widgets }
}
