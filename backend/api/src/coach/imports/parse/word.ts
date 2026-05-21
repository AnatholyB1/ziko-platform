// ─── Word Parsing ─────────────────────────────────────────────────────────────
// Converts Word (.docx) buffer to markdown for Claude text parsing.
// Uses mammoth.js — purpose-built for .docx → readable text. Phase 28 D-11.
//
// NOTE: mammoth's TypeScript declaration (lib/index.d.ts) is missing
// convertToMarkdown — it only declares convertToHtml and extractRawText.
// The function exists in the JS (exports.convertToMarkdown in lib/index.js).
// We cast mammoth to access it safely. A @types/mammoth contribution could
// fix this upstream; for now the cast is the correct approach.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

/**
 * Converts a .docx buffer to markdown string.
 *
 * mammoth.convertToMarkdown produces cleaner output than HTML for
 * Claude text prompts — less noise from HTML tags. Phase 28 D-11.
 */
export async function parseWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToMarkdown({ buffer });
  return result.value;
}
