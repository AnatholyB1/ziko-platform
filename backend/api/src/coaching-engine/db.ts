// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
//
// Re-exports the single shared client factory rather than building a second
// createClient() call inline: record_athlete_decision()'s EXECUTE grant is
// service_role-only, so SUPABASE_SERVICE_KEY must genuinely be populated in
// the deploy environment, and that requirement stays in one place this way.
export { clientForUser } from '../tools/db.js';
