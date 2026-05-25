// Types for the coach AI bounded module (Phase 29).
// No runtime code — interfaces only.

export interface CoachAlert {
  id: string;
  coach_id: string;
  client_id: string;
  alert_type: 'missed_sessions' | 'sleep_drop' | 'mood_decline' | 'rpe_inflation';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  is_read: boolean;
  created_at: string;
}

export interface AiToolAuditRow {
  id?: string;
  coach_id: string;
  tool_name: string;
  target_client_id: string | null;
  args_hash: string;
  result_status: 'success' | 'error';
  conversation_id: string | null;
}

// CoachContext is injected into the system prompt on every /coach/ai/chat/stream request.
// clients: active linked clients (revoked_at IS NULL) — used to enumerate clients for AI tools.
export interface CoachContext {
  profile: { display_name: string | null } | null;
  clients: Array<{ id: string; name: string }>;
}
