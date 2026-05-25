// ─── PDF Rasterization ────────────────────────────────────────────────────────
// Converts PDF pages to base64 PNG strings for Claude vision processing.
//
// pdfjs-dist v5 + @napi-rs/canvas (pdfjs-dist's listed optional dependency).
// @napi-rs/canvas provides DOMMatrix and createCanvas for Node.js.
//
// WHY dynamic import: pdfjs-dist v5 requires DOMMatrix to be available in
// globalThis before the module initializes. With static `import`, ES module
// hoisting causes pdfjs-dist to initialize before our polyfill code runs.
// Using a lazy-initialized singleton (initPdf) ensures the polyfill is set
// before pdfjs-dist's module initialization touches DOMMatrix.
// Phase 28 D-09, IMPORT-07.
//
// NOTE: pdfjs-dist v5 changed the rendering API from v4:
//   - RenderParameters now requires `canvas` (HTMLCanvasElement | null)
//   - `canvasContext` is deprecated; `canvas` is the primary parameter
//   - `disableWorker` option was removed — use GlobalWorkerOptions.workerSrc = '' instead

import { createCanvas, DOMMatrix } from '@napi-rs/canvas';
import type { Canvas } from '@napi-rs/canvas';

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// Holds the pdfjs-dist module after first load (avoids re-polyfilling).
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsLib) return pdfjsLib;

  // ── Global polyfills required by pdfjs-dist v5 in Node.js ──────────────
  // Must be set before pdfjs-dist module code runs.
  // Use 'in' operator on globalThis cast to object to avoid TS7017.
  const g = globalThis as Record<string, unknown>;

  if (!('DOMMatrix' in g)) {
    g.DOMMatrix = DOMMatrix;
  }

  // pdfjs-dist accesses document.createElement('canvas') in some render paths.
  if (!('document' in g)) {
    g.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return createCanvas(1, 1) as unknown as HTMLCanvasElement;
        }
        return {};
      },
    };
  }

  // Dynamic import — runs after polyfills are in place
  const lib = await import('pdfjs-dist');
  // Disable the worker for Node.js serverless — run rendering inline.
  // In pdfjs-dist v5, setting workerSrc to '' makes it fall back to the
  // main thread (fake worker mode), which is safe for serverless.
  lib.GlobalWorkerOptions.workerSrc = '';
  pdfjsLib = lib;
  return lib;
}

/**
 * Returns the number of pages in a PDF buffer.
 * Used before credit check: cost = min(pageCount, 10). Phase 28 D-01.
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const lib = await getPdfjsLib();
  const pdfData = new Uint8Array(buffer);
  const pdf = await lib.getDocument({ data: pdfData }).promise;
  const count = pdf.numPages;
  await pdf.destroy();
  return count;
}

/**
 * Rasterizes up to `maxPages` pages of a PDF to base64 PNG strings.
 *
 * @param buffer   - Raw PDF file buffer
 * @param maxPages - Hard cap on pages processed (default 30 per IMPORT-07)
 * @returns Array of raw base64 PNG strings (no data URI prefix)
 *
 * Scale 1.5: quality/speed tradeoff — readable by Claude vision, fast enough
 * to stay within the 55s Vercel function limit for 30 pages. RESEARCH.md Pattern 2.
 *
 * pdfjs-dist v5 API: RenderParameters requires `canvas` (not `canvasContext`).
 * `canvasContext` is deprecated. We pass the @napi-rs/canvas Canvas object and
 * cast it to satisfy the HTMLCanvasElement type expected by pdfjs-dist.
 */
export async function rasterizePdf(buffer: Buffer, maxPages = 30): Promise<string[]> {
  const lib = await getPdfjsLib();
  const pdfData = new Uint8Array(buffer);
  const pdf = await lib.getDocument({ data: pdfData }).promise;

  const pageCount = Math.min(pdf.numPages, maxPages);
  const base64Pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas: Canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));

    await page.render({
      // Cast: @napi-rs/canvas Canvas is compatible with HTMLCanvasElement at runtime;
      // types differ because the Canvas interface is not browser-identical.
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    // Raw base64 — strip the "data:image/png;base64," prefix
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace('data:image/png;base64,', '');
    base64Pages.push(base64);

    page.cleanup();
  }

  await pdf.destroy();
  return base64Pages;
}
