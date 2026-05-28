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

/**
 * Injected into the system prompt when the coach opens the chat drawer from
 * the Sport dashboard (AI-01, D-03/D-04).
 */
export interface DashboardContext {
  sport_type: string; // e.g. "Powerlifting"
  metrics: Record<string, string>; // e.g. { "1RM Squat (dernier)": "185 kg", "RPE moyen": "8.2" }
}

/**
 * Returned by the insights endpoint when a metric crosses a coach-configured
 * threshold (AI-04, D-13).
 */
export interface ThresholdAlert {
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  current_value: number;
}

/**
 * Full response shape from POST /coach/dashboards/:clientId/insights.
 */
export interface InsightsResponse {
  chartInsights: Record<string, string>;
  narrative: string;
  crossedThresholds: ThresholdAlert[];
}

/**
 * Row shape for coach_metric_thresholds table (AI-04, D-11).
 */
export interface CoachMetricThreshold {
  id: string;
  coach_id: string;
  client_id: string;
  sport_type: string;
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
