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
