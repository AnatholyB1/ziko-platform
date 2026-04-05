import { anthropic } from '@ai-sdk/anthropic';

// ─── AI Model Constants ─────────────────────────────────────
// Centralized model management. All AI routes import from here.
// When a model ID changes, update ONE file.

// Orchestrator agent — all AI chat routes
export const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

// Vision model — food scan (Phase 19 COST-01)
// Uses claude-haiku-4-5-20251001 — the haiku-3 model (retires April 19, 2026) has been replaced
export const VISION_MODEL = anthropic('claude-haiku-4-5-20251001');
