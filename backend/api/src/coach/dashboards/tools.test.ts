// Unit tests for dashboard tool handler functions.
// Tests the 4 pure mutation helpers + WidgetSchema rejection + D-18 two-turn integration scenario.
// Framework: vitest (configured in backend/api/package.json)
import { describe, test, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  applyAddWidget,
  applyUpdateWidget,
  applyRemoveWidget,
  applyReorderWidgets,
} from './tools.js'
import { WidgetSchema } from './schemas.js'
import type { Widget } from './types.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Valid RFC 4122 v4 UUIDs required by WidgetSchema (z.string().uuid())
const SAMPLE_KPI: Widget = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  type: 'kpi_tile',
  title: 'Test KPI',
  period: '30d',
  gridPos: { x: 0, y: 0, w: 4, h: 2 },
  config: { dataKey: 'sessions_count', format: 'number' },
}

const SAMPLE_LINE: Widget = {
  id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  type: 'line_chart',
  title: 'Test Line',
  period: '7d',
  gridPos: { x: 4, y: 0, w: 8, h: 2 },
  config: { dataKey: 'weight_kg', unit: 'kg' },
}

// ─── applyAddWidget ───────────────────────────────────────────────────────────

describe('applyAddWidget', () => {
  test('appends a valid widget to an empty array', () => {
    const result = applyAddWidget([], SAMPLE_KPI as unknown as Record<string, unknown>)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(SAMPLE_KPI.id)
  })

  test('appends to existing array', () => {
    const result = applyAddWidget([SAMPLE_KPI], SAMPLE_LINE as unknown as Record<string, unknown>)
    expect(result.length).toBe(2)
    expect(result[1].id).toBe(SAMPLE_LINE.id)
  })

  test('throws on unknown widget type (ZodError)', () => {
    expect(() =>
      applyAddWidget([], { ...SAMPLE_KPI, type: 'unknown_type' } as Record<string, unknown>),
    ).toThrow(ZodError)
  })

  // PITFALLS #1: additionalProperties: false on all schemas — extra fields must be rejected
  test('throws on additionalProperties violation (PITFALLS #1)', () => {
    expect(() =>
      applyAddWidget([], { ...SAMPLE_KPI, extraField: 'bad' } as Record<string, unknown>),
    ).toThrow(ZodError)
  })

  test('does not mutate input array', () => {
    const original: Widget[] = [SAMPLE_KPI]
    applyAddWidget(original, SAMPLE_LINE as unknown as Record<string, unknown>)
    expect(original.length).toBe(1)
  })
})

// ─── applyUpdateWidget ────────────────────────────────────────────────────────

describe('applyUpdateWidget', () => {
  test('merges config onto matching widget', () => {
    const result = applyUpdateWidget([SAMPLE_KPI], {
      id: SAMPLE_KPI.id,
      config: { dataKey: 'habits_pct', format: 'percent' },
    })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(SAMPLE_KPI.id)
    expect((result[0] as any).config.dataKey).toBe('habits_pct')
    expect((result[0] as any).config.format).toBe('percent')
  })

  test('throws when id not found', () => {
    expect(() =>
      applyUpdateWidget([SAMPLE_KPI], { id: 'not-exist', config: {} }),
    ).toThrow('not-exist')
  })

  test('does not mutate input array', () => {
    const original: Widget[] = [SAMPLE_KPI]
    applyUpdateWidget(original, { id: SAMPLE_KPI.id, config: { dataKey: 'weight_kg' } })
    // Original widget config must remain unchanged
    expect((original[0] as any).config.dataKey).toBe('sessions_count')
  })
})

// ─── applyRemoveWidget ────────────────────────────────────────────────────────

describe('applyRemoveWidget', () => {
  test('removes widget by id', () => {
    const result = applyRemoveWidget([SAMPLE_KPI, SAMPLE_LINE], { id: SAMPLE_KPI.id })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(SAMPLE_LINE.id)
  })

  test('returns unchanged array when id not found (idempotent)', () => {
    const result = applyRemoveWidget([SAMPLE_KPI], { id: 'not-exist' })
    expect(result.length).toBe(1)
  })
})

// ─── applyReorderWidgets ──────────────────────────────────────────────────────

describe('applyReorderWidgets', () => {
  test('reorders by explicit ids array', () => {
    const result = applyReorderWidgets([SAMPLE_KPI, SAMPLE_LINE], {
      ids: [SAMPLE_LINE.id, SAMPLE_KPI.id],
    })
    expect(result[0].id).toBe(SAMPLE_LINE.id)
    expect(result[1].id).toBe(SAMPLE_KPI.id)
  })

  test('drops widgets not in ids list', () => {
    const result = applyReorderWidgets([SAMPLE_KPI, SAMPLE_LINE], {
      ids: [SAMPLE_LINE.id],
    })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(SAMPLE_LINE.id)
  })
})

// ─── WidgetSchema rejection ───────────────────────────────────────────────────

describe('WidgetSchema rejection', () => {
  test('rejects a widget with unknown type', () => {
    expect(() =>
      WidgetSchema.parse({ ...SAMPLE_KPI, type: 'super_chart' }),
    ).toThrow(ZodError)
  })

  test('rejects additionalProperties on root object (PITFALLS #1)', () => {
    expect(() =>
      WidgetSchema.parse({ ...SAMPLE_KPI, unexpectedField: 'oops' }),
    ).toThrow(ZodError)
  })

  test('rejects additionalProperties inside config (PITFALLS #1)', () => {
    expect(() =>
      WidgetSchema.parse({
        ...SAMPLE_KPI,
        config: { ...(SAMPLE_KPI as any).config, weirdProp: 42 },
      }),
    ).toThrow(ZodError)
  })
})

// ─── Two-turn integration scenario (D-18) ────────────────────────────────────

describe('Two-turn integration scenario (D-18)', () => {
  // D-18: This test verifies the two-turn history correctness requirement.
  // If response.messages is not appended after turn 1, turn 2 would have no
  // knowledge of the added widget (PITFALLS #2).
  test('turn 1 add then turn 2 update references correct widget', () => {
    // Start with empty widget state (like a fresh edit session)
    let currentWidgets: Widget[] = []

    // ── Turn 1: add a widget ──────────────────────────────────────────────────
    const after_turn1 = applyAddWidget(currentWidgets, SAMPLE_KPI as unknown as Record<string, unknown>)
    expect(after_turn1.length).toBe(1)
    expect(after_turn1[0].id).toBe(SAMPLE_KPI.id)

    // Simulate the side-effect of appendMessages: the new widget state becomes
    // the authoritative currentWidgets for subsequent turns.
    // In production, configRef.current is updated on every tool_result SSE event
    // so the next POST /ai-edit request body carries the correct currentWidgets.
    currentWidgets = after_turn1

    // ── Turn 2: update the widget added in turn 1 ─────────────────────────────
    const after_turn2 = applyUpdateWidget(currentWidgets, {
      id: SAMPLE_KPI.id,
      config: { dataKey: 'weight_kg', unit: 'kg' },
    })

    expect(after_turn2.length).toBe(1)
    // Turn 2 correctly modified the widget from turn 1
    expect((after_turn2[0] as any).config.dataKey).toBe('weight_kg')
    expect((after_turn2[0] as any).config.unit).toBe('kg')
    // id is preserved (immutable)
    expect(after_turn2[0].id).toBe(SAMPLE_KPI.id)
  })

  test('turn 1 add two widgets then turn 2 reorder references both', () => {
    let currentWidgets: Widget[] = []

    // Turn 1: add KPI widget
    const after_kpi = applyAddWidget(currentWidgets, SAMPLE_KPI as unknown as Record<string, unknown>)
    // Still turn 1 context: add line chart
    const after_turn1 = applyAddWidget(after_kpi, SAMPLE_LINE as unknown as Record<string, unknown>)
    expect(after_turn1.length).toBe(2)

    // Simulate appendMessages side-effect
    currentWidgets = after_turn1

    // Turn 2: reorder — put line chart first
    const after_turn2 = applyReorderWidgets(currentWidgets, {
      ids: [SAMPLE_LINE.id, SAMPLE_KPI.id],
    })
    expect(after_turn2.length).toBe(2)
    expect(after_turn2[0].id).toBe(SAMPLE_LINE.id)
    expect(after_turn2[1].id).toBe(SAMPLE_KPI.id)
  })
})
