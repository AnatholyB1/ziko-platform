import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import type { Widget, DashboardConfig } from './types.js'

export const GridPosSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
}).strict()

export const PeriodEnum = z.enum(['7d', '30d', '90d', 'all'])

export const LineChartWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('line_chart'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    dataKey: z.string(),
    color: z.string().optional(),
    unit: z.string().optional(),
  }).strict(),
}).strict()

export const BarChartWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('bar_chart'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    dataKey: z.string(),
    color: z.string().optional(),
    unit: z.string().optional(),
  }).strict(),
}).strict()

export const KpiTileWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('kpi_tile'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    dataKey: z.string(),
    unit: z.string().optional(),
    format: z.enum(['number', 'percent', 'duration']).default('number'),
  }).strict(),
}).strict()

export const TableWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('table'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    columns: z.array(
      z.object({ key: z.string(), label: z.string() }).strict()
    ).min(1),
  }).strict(),
}).strict()

export const AthleteListWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('athlete_list'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    filter: z.enum(['all', 'active', 'at_risk']).default('all'),
  }).strict(),
}).strict()

export const ThresholdIndicatorWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('threshold_indicator'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    dataKey: z.string(),
    threshold: z.number(),
    unit: z.string().optional(),
  }).strict(),
}).strict()

export const CalloutWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('callout'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    message: z.string().min(1).max(500),
    severity: z.enum(['info', 'warning', 'success']).default('info'),
  }).strict(),
}).strict()

export const WidgetSchema = z.discriminatedUnion('type', [
  LineChartWidgetSchema,
  BarChartWidgetSchema,
  KpiTileWidgetSchema,
  TableWidgetSchema,
  AthleteListWidgetSchema,
  ThresholdIndicatorWidgetSchema,
  CalloutWidgetSchema,
])

export const DashboardConfigSchema = z.object({
  schema_version: z.literal(1),
  widgets: z.array(WidgetSchema).max(12),
}).strict()

export const DEFAULT_WIDGETS: DashboardConfig = {
  schema_version: 1,
  widgets: [
    {
      id: randomUUID(),
      type: 'kpi_tile',
      title: 'Séances ce mois',
      period: '30d',
      gridPos: { x: 0, y: 0, w: 4, h: 2 },
      config: { dataKey: 'sessions_count', format: 'number' },
    },
    {
      id: randomUUID(),
      type: 'line_chart',
      title: 'Poids',
      period: '30d',
      gridPos: { x: 4, y: 0, w: 8, h: 2 },
      config: { dataKey: 'weight_kg', unit: 'kg' },
    },
    {
      id: randomUUID(),
      type: 'kpi_tile',
      title: 'Habitudes',
      period: '7d',
      gridPos: { x: 0, y: 2, w: 4, h: 2 },
      config: { dataKey: 'habits_pct', format: 'percent' },
    },
    {
      id: randomUUID(),
      type: 'bar_chart',
      title: 'Sommeil',
      period: '30d',
      gridPos: { x: 4, y: 2, w: 8, h: 2 },
      config: { dataKey: 'sleep_duration_hours', unit: 'h' },
    },
  ],
}

export type WidgetInput = z.input<typeof WidgetSchema>
export type PutDashboardBody = { widgets: z.infer<typeof WidgetSchema>[] }
