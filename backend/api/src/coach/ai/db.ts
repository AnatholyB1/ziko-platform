// Data access layer for coach AI bounded module (Phase 29).
// createUserClient: per-request JWT — RLS is_coach_of fires automatically.
// createServiceClient: service key — for cron inserts and fire-and-forget audit writes.
// ARCH-03: coach reads always use createUserClient(jwt), never service client.
import { createClient } from '@supabase/supabase-js';
import { createUserClient as _createUserClient } from '../clients/db.js';
import type { CoachAlert, AiToolAuditRow } from './types.js';

// Re-export createUserClient for tool executors to use directly.
// MUST use JWT client — service key bypasses is_coach_of RLS.
export { createUserClient } from '../clients/db.js';

function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ----- Alerts ----------------------------------------------------------------

export async function getCoachAlerts(jwt: string, coachId: string): Promise<CoachAlert[]> {
  const db = _createUserClient(jwt);
  const { data, error } = await db
    .from('coach_alerts')
    .select('id, coach_id, client_id, alert_type, severity, summary, is_read, created_at')
    .eq('coach_id', coachId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachAlert[];
}

export async function markAlertRead(jwt: string, alertId: string, coachId: string): Promise<void> {
  const db = _createUserClient(jwt);
  const { error } = await db
    .from('coach_alerts')
    .update({ is_read: true })
    .eq('id', alertId)
    .eq('coach_id', coachId); // defense-in-depth on top of RLS
  if (error) throw new Error(error.message);
}

export async function markAllAlertsRead(jwt: string, coachId: string): Promise<void> {
  const db = _createUserClient(jwt);
  const { error } = await db
    .from('coach_alerts')
    .update({ is_read: true })
    .eq('coach_id', coachId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
}

export async function insertAlerts(
  alerts: Array<{
    coach_id: string;
    client_id: string;
    alert_type: 'missed_sessions' | 'sleep_drop' | 'mood_decline' | 'rpe_inflation';
    severity: 'low' | 'medium' | 'high';
    summary: string;
  }>,
): Promise<void> {
  if (alerts.length === 0) return;
  const db = createServiceClient();
  const { error } = await db.from('coach_alerts').insert(alerts);
  if (error) throw new Error(error.message);
}

// ----- Audit -----------------------------------------------------------------

export function logToolAudit(row: {
  coachId: string;
  toolName: string;
  targetClientId: string | null;
  argsHash: string;
  resultStatus: 'success' | 'error';
  conversationId: string | null;
}): void {
  const db = createServiceClient();
  const payload: Omit<AiToolAuditRow, 'id'> = {
    coach_id: row.coachId,
    tool_name: row.toolName,
    target_client_id: row.targetClientId,
    args_hash: row.argsHash,
    result_status: row.resultStatus,
    conversation_id: row.conversationId,
  };
  // Fire-and-forget — never await; never crash the caller
  Promise.resolve(db.from('ai_tool_audit').insert(payload)).catch((err: unknown) =>
    console.error('[ToolAudit] insert failed:', err),
  );
}

// ----- Cron ------------------------------------------------------------------

export async function listCoachesForCron(): Promise<{ coachId: string }[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('coach_profiles')
    .select('user_id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ coachId: row.user_id as string }));
}
