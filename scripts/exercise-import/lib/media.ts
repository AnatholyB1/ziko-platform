/**
 * Media resize/cap enforcement for the exercise-import merge pipeline
 * (MEDIA-03). This module structurally enforces the Gym visual license's
 * 180x180 ceiling at the upload step — the merge loop has no code path
 * that can upload un-capped bytes, because these functions are the only
 * way media bytes leave this module. Upscaling below the cap is forbidden
 * by the license and is never performed.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import sharp from 'sharp';

// The Gym visual license's resolution ceiling. Both dimensions of any
// output image must be <= this value. See README.md and 03-CONTEXT.md D-01.
export const MEDIA_CAP_PX = 180;

/**
 * Resizes a still image so neither dimension exceeds MEDIA_CAP_PX,
 * preserving aspect ratio, and never upscales a smaller source. Output is
 * always PNG. Pure Buffer -> Buffer: no filesystem/network I/O, no
 * Supabase client — the caller (merge.ts) supplies and persists the bytes.
 */
export async function capImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({
      width: MEDIA_CAP_PX,
      height: MEDIA_CAP_PX,
      // Both resize options below are mandatory and must never be removed:
      // fit "inside" guarantees both output dimensions stay <= MEDIA_CAP_PX
      // (a ceiling, not a fixed canvas) while preserving aspect ratio, and
      // withoutEnlargement guarantees a source smaller than the cap is
      // never upscaled (license-mandated).
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

/**
 * Resizes an animated GIF so neither dimension exceeds MEDIA_CAP_PX,
 * preserving aspect ratio and animation, and never upscales a smaller
 * source. Output is always GIF. Pure Buffer -> Buffer: no filesystem/
 * network I/O, no Supabase client — the caller (merge.ts) supplies and
 * persists the bytes.
 */
export async function capGif(input: Buffer): Promise<Buffer> {
  // Pitfall 6: without { animated: true }, sharp reads only the first
  // frame and silently emits a static image with a .gif extension. This
  // constructor option is mandatory and must never be removed.
  return sharp(input, { animated: true })
    .resize({
      width: MEDIA_CAP_PX,
      height: MEDIA_CAP_PX,
      // Both resize options below are mandatory and must never be removed
      // — see capImage's comment above for why.
      fit: 'inside',
      withoutEnlargement: true,
    })
    .gif()
    .toBuffer();
}
