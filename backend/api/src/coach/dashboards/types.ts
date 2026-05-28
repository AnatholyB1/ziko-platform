// Types for the coach dashboards bounded module (custom-widget workstream).
// No runtime code — interfaces only.

export type WidgetType =
  | 'line_chart'
  | 'bar_chart'
  | 'kpi_tile'
  | 'table'
  | 'athlete_list'
  | 'threshold_indicator'
  | 'callout'

export type WidgetPeriod = '7d' | '30d' | '90d' | 'all'

export interface GridPos {
  x: number
  y: number
  w: number
  h: number
}

export interface WidgetBase {
  id: string
  type: WidgetType
  title: string
  period: WidgetPeriod
  gridPos: GridPos
}

export interface LineChartConfig {
  dataKey: string
  color?: string
  unit?: string
}

export interface BarChartConfig {
  dataKey: string
  color?: string
  unit?: string
}

export interface KpiTileConfig {
  dataKey: string
  unit?: string
  format: 'number' | 'percent' | 'duration'
}

export interface TableConfig {
  columns: Array<{ key: string; label: string }>
}

export interface AthleteListConfig {
  filter: 'all' | 'active' | 'at_risk'
}

export interface ThresholdIndicatorConfig {
  dataKey: string
  threshold: number
  unit?: string
}

export interface CalloutConfig {
  message: string
  severity: 'info' | 'warning' | 'success'
}

export interface LineChartWidget extends WidgetBase {
  type: 'line_chart'
  config: LineChartConfig
}

export interface BarChartWidget extends WidgetBase {
  type: 'bar_chart'
  config: BarChartConfig
}

export interface KpiTileWidget extends WidgetBase {
  type: 'kpi_tile'
  config: KpiTileConfig
}

export interface TableWidget extends WidgetBase {
  type: 'table'
  config: TableConfig
}

export interface AthleteListWidget extends WidgetBase {
  type: 'athlete_list'
  config: AthleteListConfig
}

export interface ThresholdIndicatorWidget extends WidgetBase {
  type: 'threshold_indicator'
  config: ThresholdIndicatorConfig
}

export interface CalloutWidget extends WidgetBase {
  type: 'callout'
  config: CalloutConfig
}

export type Widget =
  | LineChartWidget
  | BarChartWidget
  | KpiTileWidget
  | TableWidget
  | AthleteListWidget
  | ThresholdIndicatorWidget
  | CalloutWidget

export interface DashboardConfig {
  schema_version: 1
  widgets: Widget[]
}

export interface DashboardConfigRow {
  id: string
  coach_id: string
  client_id: string
  widgets: Widget[]
  updated_at: string
  created_at: string
}

export interface CoachMemoryPreferences {
  preferred_period?: '7d' | '30d' | '90d'
  preferred_widgets?: string[]
  preferred_chart_type?: 'line' | 'bar'
}

export interface CoachMemoryTemplate {
  id: string
  name: string
  widgets: Widget[]
  created_at: string
}

export interface CoachMemoryData {
  preferences: CoachMemoryPreferences
  templates: CoachMemoryTemplate[]
  recent_actions: string[]
}

export interface CoachMemoryRow {
  id: string
  coach_id: string
  memory: CoachMemoryData
  updated_at: string
}
