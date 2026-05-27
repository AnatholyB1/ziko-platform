// Coach Voice bounded module — Phase 01-03 (Retour Vocal).
// Exposes: POST /coach/voice/transcribe
// Full Whisper transcription implementation.

// Vercel: allow up to 60s for audio transcription operations
export const maxDuration = 60;

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import OpenAI, { toFile } from 'openai';
import { authMiddleware } from '../../middleware/auth.js';
import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { AGENT_MODEL } from '../../config/models.js';
import { createUserClient } from '../clients/db.js';

// OpenAI client at module scope — avoid re-instantiation on every request
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Allowed audio MIME types (T-01-04: mimeType whitelist validation)
const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4'];

export const voiceRouter = new Hono();

// All voice routes require a valid Supabase JWT (D-07 / T-01-02 security requirement)
voiceRouter.use('*', authMiddleware);

// POST /transcribe — accepts multipart/form-data with an "audio" File field + optional "mimeType" field
// Returns { transcript: string } on success
voiceRouter.post(
  '/transcribe',
  bodyLimit({
    maxSize: 20 * 1024 * 1024, // 20 MB max (T-01-03)
    onError: (c) => c.json({ error: 'Audio file too large (max 20 MB)' }, 413),
  }),
  async (c) => {
    // 1. Parse multipart body
    const body = await c.req.parseBody();

    // 2. Validate audio field
    const audioFile = body['audio'];
    if (!(audioFile instanceof File)) {
      return c.json({ error: 'audio field is required' }, 400);
    }

    // 3. Validate mimeType against whitelist (T-01-04)
    const mimeType = (body['mimeType'] as string) ?? 'audio/webm';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return c.json({ error: 'Unsupported audio format. Use webm or mp4.' }, 400);
    }

    try {
      // 4. Convert File to Buffer
      const buffer = Buffer.from(await audioFile.arrayBuffer());

      // 5. Derive filename extension from mimeType
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

      // 6. Wrap in OpenAI-compatible File object
      const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

      // 7. Call Whisper-1 with language: 'fr' hardcoded (D-06 — never auto-detect)
      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'fr',
      });

      // 8. Return transcript
      return c.json({ transcript: response.text });
    } catch (err: any) {
      console.error('[coach/voice] transcribe error:', err.message);
      return c.json({ error: err.message ?? 'Transcription failed' }, 500);
    }
  },
);

// ─── Anthropic schema sanitizer ─────────────────────────────────────────────
// Anthropic structured output only supports a subset of JSON Schema keywords.
// Rejected keywords: minimum, maximum, exclusiveMinimum, exclusiveMaximum,
//                   minLength, maxLength, minItems, maxItems, multipleOf, $schema.
const ANTHROPIC_BANNED_KEYWORDS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'multipleOf', '$schema', 'format',
]);

function stripUnsupportedKeywords(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !ANTHROPIC_BANNED_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupportedKeywords(value)]),
  );
}

// Build a clean jsonSchema wrapper from a Zod type, stripping all Anthropic-
// unsupported keywords that the SDK converter injects implicitly.
function anthropicSchema<T>(zodType: z.ZodTypeAny) {
  const raw = zodSchema(zodType).jsonSchema;
  return jsonSchema<T>(stripUnsupportedKeywords(raw) as any);
}

// ─── StructuredCard schema ───────────────────────────────────────────────────
const StructuredCardZod = z.object({
  context:     z.string(),
  strengths:   z.string(),
  corrections: z.string(),
  next_steps:  z.string(),
  tags:        z.array(z.enum(['force', 'technique', 'mental', 'cardio', 'recuperation'])),
});

const CARD_SCHEMA = anthropicSchema<z.infer<typeof StructuredCardZod>>(StructuredCardZod);

// ─── Claude system prompt ────────────────────────────────────────────────────
const STRUCTURING_SYSTEM_PROMPT = `Tu es un assistant expert pour les coachs de fitness.
À partir du transcript d'un retour vocal du coach et du contexte complet de l'athlète,
produis une card structurée avec exactement 5 sections.

Règles:
- context: résumé factuel de la séance (exercices, charges, RPE) — 2-4 phrases
- strengths: ce que l'athlète a bien fait — liste ou prose, 2-3 points
- corrections: corrections techniques ou comportementales — 2-3 points précis
- next_steps: recommandations concrètes pour la prochaine séance ou la semaine
- tags: tableau de 1 à 3 tags parmi ["force","technique","mental","cardio","recuperation"]
  choisis uniquement ceux qui correspondent au contenu du retour vocal

Réponds uniquement avec le JSON demandé. Pas d'explication.`;

// ─── Prompt builder ──────────────────────────────────────────────────────────
function buildStructuringPrompt(
  transcript: string,
  ctx: {
    sessions: any[];
    sets: any[];
    measurements: any[];
    sleep_scores: any[];
    coach_notes: string;
    vocal_history: any[];
  },
): string {
  const sessionLines = ctx.sessions.map((s, i) => {
    const sessionSets = ctx.sets.filter((set: any) => set.session_id === s.id);
    const setsSummary = sessionSets
      .slice(0, 8) // cap to avoid token bloat
      .map((set: any) => `    Set ${set.set_number}: ${set.reps}×${set.weight_kg}kg RPE${set.rpe ?? '?'}`)
      .join('\n');
    return `  Séance ${i + 1} (${s.started_at?.split('T')[0] ?? 'date inconnue'}): ${s.name ?? 'Sans nom'}\n${setsSummary}`;
  }).join('\n');

  const measurementLines = ctx.measurements
    .map((m: any) => `  ${m.created_at?.split('T')[0]}: ${m.weight_kg}kg, BF ${m.body_fat_pct ?? '?'}%`)
    .join('\n');

  const sleepLines = ctx.sleep_scores
    .map((s: any) => `  ${s.date}: ${s.duration_hours}h qualité ${s.quality}/5`)
    .join('\n');

  return `## Transcript du retour vocal du coach
${transcript}

## Contexte athlète
### 10 dernières séances
${sessionLines || '  Aucune séance enregistrée'}

### Mesures récentes
${measurementLines || '  Aucune mesure'}

### Sommeil (14 derniers jours)
${sleepLines || '  Aucune donnée sommeil'}

### Notes privées du coach
${ctx.coach_notes || '  Aucune note'}

### Historique feedbacks vocaux
${ctx.vocal_history.length === 0 ? '  Aucun feedback précédent' : ctx.vocal_history.map((f: any) => `  ${f.created_at}: ${JSON.stringify(f.card)}`).join('\n')}`;
}

// ─── Transcript length guard ─────────────────────────────────────────────────
const MAX_TRANSCRIPT_LENGTH = 10_000;

// ─── POST /structure ─────────────────────────────────────────────────────────
// Assembles athlete context from Supabase (coach JWT RLS), calls Claude via
// generateObject, and returns the 5-section StructuredCard JSON.
voiceRouter.post('/structure', async (c) => {
  const { userId: coachId } = c.get('auth');
  void coachId; // coachId used implicitly via coach JWT for RLS
  const jwt = c.req.header('Authorization')!.slice(7);

  const body = await c.req.json<{ athlete_id: string; transcript: string }>();
  if (!body.athlete_id || !body.transcript) {
    return c.json({ error: 'athlete_id and transcript are required' }, 400);
  }

  const { athlete_id, transcript } = body;

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return c.json({ error: 'Transcript too long (max 10 000 characters)' }, 400);
  }

  // --- Fetch athlete context (coach JWT — RLS enforces is_coach_of()) ---
  const db = createUserClient(jwt);

  const { data: sessions } = await db
    .from('workout_sessions')
    .select('id, name, started_at, total_volume_kg')
    .eq('user_id', athlete_id)
    .order('started_at', { ascending: false })
    .limit(10);

  const sessionIds = (sessions ?? []).map((s: any) => s.id);

  const [setsRes, measurementsRes, sleepRes, noteRes, vocalHistoryRes] = await Promise.all([
    sessionIds.length > 0
      ? db
          .from('session_sets')
          .select('session_id, set_number, reps, weight_kg, rpe')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    db
      .from('body_measurements')
      .select('weight_kg, body_fat_pct, created_at')
      .eq('user_id', athlete_id)
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('sleep_logs')
      .select('date, duration_hours, quality')
      .eq('user_id', athlete_id)
      .order('date', { ascending: false })
      .limit(14),
    db
      .from('coach_client_notes')
      .select('content')
      .eq('client_id', athlete_id)
      // coach_id constraint is enforced by RLS (auth.uid() = coach_id)
      .maybeSingle(),
    db
      .from('coach_vocal_feedbacks')
      .select('created_at, card')
      .eq('athlete_id', athlete_id)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const athleteContext = {
    sessions: sessions ?? [],
    sets: (setsRes as any).data ?? [],
    measurements: (measurementsRes as any).data ?? [],
    sleep_scores: (sleepRes as any).data ?? [],
    coach_notes: (noteRes as any).data?.content ?? '',
    vocal_history: (vocalHistoryRes as any).data ?? [],
  };

  // --- generateObject with Claude ---
  try {
    const { object: card } = await generateObject({
      model: AGENT_MODEL,
      schema: CARD_SCHEMA,
      system: STRUCTURING_SYSTEM_PROMPT,
      prompt: buildStructuringPrompt(transcript, athleteContext),
    });
    return c.json({ card });
  } catch (err: any) {
    if (err instanceof NoObjectGeneratedError) {
      console.error('[coach/voice] structure NoObjectGeneratedError:', err.message);
      return c.json({ error: "La structuration a échoué — Claude n'a pas retourné de JSON valide." }, 502);
    }
    console.error('[coach/voice] structure error:', err.message);
    return c.json({ error: err.message ?? 'Structuration failed' }, 500);
  }
});

// ─── POST /save ──────────────────────────────────────────────────────────────
// Persists a structured feedback card to coach_vocal_feedbacks.
// Payload: { athlete_id, transcript, card } — card is the full StructuredCard JSON.
// Returns: { id } of the new row.
voiceRouter.post('/save', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  const body = await c.req.json<{ athlete_id: string; transcript: string; card: unknown }>();
  if (!body.athlete_id || !body.transcript || !body.card) {
    return c.json({ error: 'athlete_id, transcript, and card are required' }, 400);
  }

  const { athlete_id, transcript, card } = body;
  const db = createUserClient(jwt);

  const { data, error } = await db
    .from('coach_vocal_feedbacks')
    .insert({ coach_id: coachId, athlete_id, transcript, card })
    .select('id')
    .single();

  if (error) {
    console.error('[coach/voice] save error:', error.message);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ id: (data as any).id }, 201);
});
