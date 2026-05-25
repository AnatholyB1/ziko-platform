// ─── Claude Parse Wrapper ─────────────────────────────────────────────────────
// generateObject wrappers for the two parse paths: vision (PDF/image) and
// text (Excel CSV / Word markdown). Phase 28 D-14, IMPORT-08.
//
// Both functions use VISION_MODEL (claude-haiku-4-5-20251001) — D-13.
// Both throw on failure (NoObjectGeneratedError or network) — caller is
// responsible for catching and setting ai_imports.status = 'failed' (D-03).
//
// Confidence instruction (Pitfall 8):
//   - exercise.confidence per field (ExerciseSchema has confidence: z.number())
//   - overall_confidence as weighted average at program level
//   Sessions and weeks have NO confidence fields (ImportedProgramSchema.strict())
//
// Security (T-28-02-01):
//   File content is passed as structured data blocks (base64/CSV/markdown),
//   NOT as system prompt text. generateObject's Zod schema enforces output
//   shape — injected content cannot alter the schema structure.
//
// Schema sanitization (IMPORT-BUG-01):
//   @ai-sdk/provider-utils adds implicit minimum/maximum on ALL z.number().int()
//   fields (Number.MIN/MAX_SAFE_INTEGER), which Anthropic rejects. Similarly,
//   minItems/maxItems on arrays and minLength/maxLength on strings are unsupported.
//   stripUnsupportedKeywords removes all disallowed keywords before sending.

import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { VISION_MODEL } from '../../../config/models.js';
import { ImportedProgramSchema } from '@ziko/coach-sdk';
import type { z } from 'zod';

// Re-export NoObjectGeneratedError so the route handler can import it from here
// without needing a direct 'ai' import (reduces coupling).
export { NoObjectGeneratedError };

// ─── Anthropic schema sanitizer ────────────────────────────────────────────────
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

const PARSE_SCHEMA = anthropicSchema<z.infer<typeof ImportedProgramSchema>>(ImportedProgramSchema);

// Shared instruction injected in both parse paths (IMPORT-03, Pitfall 8)
const CONFIDENCE_INSTRUCTION = `
Extract the workout program from the provided content into the required JSON structure.

For each exercise:
- Set the \`confidence\` field (0.0–1.0) based on how clearly the exercise appears in the document.
  - 1.0 = all fields (name, sets, reps) clearly stated
  - 0.5 = some fields inferred or partially visible
  - 0.0 = exercise mentioned but details unclear or missing

Set \`overall_confidence\` to the weighted average of all exercise confidence values across all sessions and weeks.

If page headers indicate "Week N", map exercises to the correct \`week_number\`.
`.trim();

/**
 * Parses PDF pages (or a single image) using Claude vision.
 *
 * @param base64Pages - Array of raw base64 PNG strings (no data URI prefix)
 * @returns Validated ImportedProgramSchema object
 * @throws NoObjectGeneratedError | Error — caller sets status = 'failed'
 */
export async function parseWithVision(
  base64Pages: string[],
): Promise<z.infer<typeof ImportedProgramSchema>> {
  // Build image content blocks — one per page
  const imageBlocks = base64Pages.map((b64) => ({
    type: 'image' as const,
    image: b64,
    mimeType: 'image/png' as const,
  }));

  const textBlock = {
    type: 'text' as const,
    text: `${CONFIDENCE_INSTRUCTION}\n\nDocument has ${base64Pages.length} page(s).`,
  };

  const { object } = await generateObject({
    model: VISION_MODEL,
    schema: PARSE_SCHEMA,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, textBlock],
      },
    ],
  });

  return object;
}

/**
 * Parses Excel (CSV) or Word (markdown) text content using Claude text model.
 *
 * Uses the same VISION_MODEL (Haiku) as the PDF path per D-13.
 * The model handles text content without requiring vision tokens.
 *
 * @param textContent - CSV string (from parseExcel) or markdown (from parseWord)
 * @returns Validated ImportedProgramSchema object
 * @throws NoObjectGeneratedError | Error — caller sets status = 'failed'
 */
export async function parseWithText(
  textContent: string,
): Promise<z.infer<typeof ImportedProgramSchema>> {
  // Prepend the instruction so Claude sees it before the raw content
  const prompt = `${CONFIDENCE_INSTRUCTION}\n\n---\n\n${textContent}`;

  const { object } = await generateObject({
    model: VISION_MODEL,
    schema: PARSE_SCHEMA,
    prompt,
  });

  return object;
}
