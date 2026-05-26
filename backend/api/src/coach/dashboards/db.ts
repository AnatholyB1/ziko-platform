import { createUserClient } from '../clients/db.js'
import type { Widget, DashboardConfig, DashboardConfigRow, CoachMemoryRow } from './types.js'
import { WidgetSchema, DEFAULT_WIDGETS } from './schemas.js'

export { createUserClient }

export async function getDashboardConfig(jwt: string, coachId: string, clientId: string): Promise<DashboardConfig> {
  const db = createUserClient(jwt)
  const { data, error } = await db
    .from('dashboard_configs')
    .select('widgets')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { schema_version: 1, widgets: DEFAULT_WIDGETS.widgets }
  return { schema_version: 1, widgets: data.widgets as Widget[] }
}

export async function upsertDashboardConfig(jwt: string, coachId: string, clientId: string, widgets: unknown[]): Promise<DashboardConfigRow> {
  const validatedWidgets = widgets.map(w => WidgetSchema.parse(w))
  const db = createUserClient(jwt)
  const { data, error } = await db
    .from('dashboard_configs')
    .upsert(
      { coach_id: coachId, client_id: clientId, widgets: validatedWidgets, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,client_id' }
    )
    .select('id,coach_id,client_id,widgets,updated_at,created_at')
    .single()
  if (error) throw new Error(error.message)
  return data as DashboardConfigRow
}

export async function deleteDashboardConfig(jwt: string, coachId: string, clientId: string): Promise<void> {
  const db = createUserClient(jwt)
  const { error } = await db
    .from('dashboard_configs')
    .delete()
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
  if (error) throw new Error(error.message)
}

export async function getCoachMemory(jwt: string, coachId: string): Promise<CoachMemoryRow | null> {
  const db = createUserClient(jwt)
  const { data, error } = await db
    .from('coach_memory')
    .select('id,coach_id,memory,updated_at')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as CoachMemoryRow | null
}

export async function upsertCoachMemory(jwt: string, coachId: string, memory: unknown): Promise<CoachMemoryRow> {
  const db = createUserClient(jwt)
  const { data, error } = await db
    .from('coach_memory')
    .upsert(
      { coach_id: coachId, memory, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id' }
    )
    .select('id,coach_id,memory,updated_at')
    .single()
  if (error) throw new Error(error.message)
  return data as CoachMemoryRow
}

export async function getWidgetData(
  jwt: string,
  coachId: string,
  clientId: string,
  type: string,
  period: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  // Validate period
  const validPeriods = ['7d', '30d', '90d', 'all']
  if (!validPeriods.includes(period)) throw new Error('Invalid period')

  // Compute since date
  const sinceMs: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  const since = period === 'all'
    ? '2020-01-01T00:00:00.000Z'
    : new Date(Date.now() - sinceMs[period] * 86400000).toISOString()
  const sinceDate = since.split('T')[0]

  const db = createUserClient(jwt)

  switch (type) {
    case 'line_chart':
    case 'bar_chart': {
      const dataKey = params.dataKey ?? ''
      if (dataKey === 'weight_kg') {
        const { data, error } = await db.from('body_measurements').select('created_at, weight_kg').eq('user_id', clientId).gte('created_at', since).order('created_at', { ascending: true })
        if (error) throw new Error(error.message)
        return { entries: (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], value: r.weight_kg })) }
      }
      if (dataKey === 'sleep_duration_hours') {
        const { data, error } = await db.from('sleep_logs').select('date, duration_hours').eq('user_id', clientId).gte('date', sinceDate).order('date', { ascending: true })
        if (error) throw new Error(error.message)
        return { entries: (data ?? []).map((r: any) => ({ date: r.date, value: r.duration_hours })) }
      }
      if (dataKey === 'mood') {
        const { data, error } = await db.from('journal_entries').select('created_at, mood').eq('user_id', clientId).gte('created_at', since).order('created_at', { ascending: true })
        if (error) throw new Error(error.message)
        return { entries: (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], value: r.mood })) }
      }
      return { entries: [] }
    }

    case 'kpi_tile': {
      const dataKey = params.dataKey ?? ''
      if (dataKey === 'sessions_count') {
        const { count, error } = await db.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', clientId).gte('created_at', since)
        if (error) throw new Error(error.message)
        return { value: count ?? 0, label: 'séances' }
      }
      if (dataKey === 'weight_kg') {
        const { data, error } = await db.from('body_measurements').select('weight_kg').eq('user_id', clientId).order('created_at', { ascending: false }).limit(1)
        if (error) throw new Error(error.message)
        return { value: data?.[0]?.weight_kg ?? 0, label: 'kg' }
      }
      if (dataKey === 'sleep_duration_hours') {
        const { data, error } = await db.from('sleep_logs').select('duration_hours').eq('user_id', clientId).gte('date', sinceDate)
        if (error) throw new Error(error.message)
        const avg = data && data.length > 0 ? data.reduce((sum: number, r: any) => sum + r.duration_hours, 0) / data.length : 0
        return { value: Math.round(avg * 10) / 10, label: 'h de sommeil' }
      }
      if (dataKey === 'habits_pct') {
        const { data, error } = await db.from('habit_logs').select('id').eq('user_id', clientId).gte('date', sinceDate)
        if (error) throw new Error(error.message)
        const { count: habitCount, error: hErr } = await db.from('habits').select('id', { count: 'exact', head: true }).eq('user_id', clientId).eq('is_active', true)
        if (hErr) throw new Error(hErr.message)
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
        const possible = (habitCount ?? 0) * days
        const pct = possible > 0 ? Math.round(((data?.length ?? 0) / possible) * 100) : 0
        return { value: pct, label: 'habitudes' }
      }
      return { value: 0, label: params.dataKey ?? 'metric' }
    }

    case 'table': {
      const dataKey = params.dataKey ?? ''
      const limit = period === '7d' ? 7 : period === '30d' ? 20 : period === '90d' ? 50 : 100
      if (dataKey === 'sessions') {
        const { data, error } = await db.from('workout_sessions').select('id, name, created_at').eq('user_id', clientId).gte('created_at', since).order('created_at', { ascending: false }).limit(limit)
        if (error) throw new Error(error.message)
        return { rows: (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], name: r.name ?? 'Séance', duration: '-' })) }
      }
      if (dataKey === 'nutrition') {
        const { data, error } = await db.from('nutrition_logs').select('food_name, calories, date').eq('user_id', clientId).gte('date', sinceDate).order('date', { ascending: false }).limit(limit)
        if (error) throw new Error(error.message)
        return { rows: (data ?? []).map((r: any) => ({ date: r.date, food: r.food_name, calories: r.calories })) }
      }
      if (dataKey === 'measurements') {
        const { data, error } = await db.from('body_measurements').select('weight_kg, created_at').eq('user_id', clientId).gte('created_at', since).order('created_at', { ascending: false }).limit(limit)
        if (error) throw new Error(error.message)
        return { rows: (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], weight: r.weight_kg })) }
      }
      return { rows: [] }
    }

    case 'athlete_list': {
      const filter = params.filter ?? 'all'
      const { data: links, error: linksErr } = await db.from('coach_client_links').select('client_id').eq('coach_id', coachId).is('revoked_at', null)
      if (linksErr) throw new Error(linksErr.message)
      const clientIds = (links ?? []).map((l: any) => l.client_id)
      if (clientIds.length === 0) return { athletes: [] }
      const { data: profiles, error: profilesErr } = await db.from('user_profiles').select('id, name').in('id', clientIds)
      if (profilesErr) throw new Error(profilesErr.message)
      const cutoff14d = new Date(Date.now() - 14 * 86400000).toISOString()
      const athletes = await Promise.all((profiles ?? []).map(async (p: any) => {
        const { data: sessions } = await db.from('workout_sessions').select('created_at').eq('user_id', p.id).order('created_at', { ascending: false }).limit(1)
        const last_active = sessions?.[0]?.created_at ?? null
        return { id: p.id, name: p.name, last_active }
      }))
      const filtered = filter === 'active'
        ? athletes.filter(a => a.last_active && a.last_active > cutoff14d)
        : filter === 'at_risk'
        ? athletes.filter(a => !a.last_active || a.last_active <= cutoff14d)
        : athletes
      return { athletes: filtered }
    }

    case 'threshold_indicator': {
      const kpiResult = await getWidgetData(jwt, coachId, clientId, 'kpi_tile', period, params)
      return {
        value: (kpiResult as any).value ?? 0,
        threshold: parseFloat(params.threshold ?? '0'),
        unit: params.unit,
      }
    }

    case 'callout':
      return { message: params.message ?? '', severity: params.severity ?? 'info' }

    default:
      throw new Error(`Unknown widget type: ${type}`)
  }
}
