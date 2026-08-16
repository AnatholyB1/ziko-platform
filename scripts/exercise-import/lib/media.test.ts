// Unit tests for scripts/exercise-import/lib/media.ts (MEDIA-03).
// Fixtures are generated in-test with sharp itself rather than committing
// binary fixtures, matching the plan's recommended approach.
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { capImage, capGif, MEDIA_CAP_PX } from './media';

// ─── Fixture helpers ────────────────────────────────────────────────────────

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 92, b: 26, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Builds a multi-frame animated GIF fixture: `frames` distinct still PNGs
 * are joined into a single animated image via sharp's array-input `join`
 * option (each buffer becomes one page/frame), then encoded as GIF. Frames
 * use different background colors so they are genuinely distinct pages,
 * not just visually-identical duplicates.
 */
async function makeAnimatedGif(frameWidth: number, frameHeight: number, frames: number): Promise<Buffer> {
  const framePngs = await Promise.all(
    Array.from({ length: frames }, (_, i) =>
      sharp({
        create: {
          width: frameWidth,
          height: frameHeight,
          channels: 4,
          background: { r: (i * 50) % 255, g: 26, b: 23, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    ),
  );

  return sharp(framePngs, { join: { animated: true, across: 1 } })
    .gif()
    .toBuffer();
}

// ─── MEDIA_CAP_PX ───────────────────────────────────────────────────────────

describe('MEDIA_CAP_PX', () => {
  it('is 180', () => {
    expect(MEDIA_CAP_PX).toBe(180);
  });
});

// ─── capImage ───────────────────────────────────────────────────────────────

describe('capImage', () => {
  it('caps a 400x300 source to <= 180 in both dimensions, preserving aspect ratio', async () => {
    const source = await makePng(400, 300);
    const out = await capImage(source);
    const meta = await sharp(out).metadata();

    expect(meta.width).toBeLessThanOrEqual(MEDIA_CAP_PX);
    expect(meta.height).toBeLessThanOrEqual(MEDIA_CAP_PX);
    // fit: 'inside' is a ceiling, not a fixed canvas — 400x300 (4:3) should
    // land on 180x135, not a forced 180x180.
    expect(meta.width).toBe(180);
    expect(meta.height).toBe(135);
  });

  it('never upscales a 90x90 source (stays 90x90, not merely <= 180)', async () => {
    const source = await makePng(90, 90);
    const out = await capImage(source);
    const meta = await sharp(out).metadata();

    expect(meta.width).toBe(90);
    expect(meta.height).toBe(90);
  });

  it('leaves an exactly-180x180 source unchanged', async () => {
    const source = await makePng(180, 180);
    const out = await capImage(source);
    const meta = await sharp(out).metadata();

    expect(meta.width).toBe(180);
    expect(meta.height).toBe(180);
  });

  it('outputs PNG format', async () => {
    const source = await makePng(300, 300);
    const out = await capImage(source);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe('png');
  });
});

// ─── capGif ─────────────────────────────────────────────────────────────────

describe('capGif', () => {
  it('caps a multi-frame 400x400 animated GIF to <= 180 per page, preserving animation', async () => {
    const source = await makeAnimatedGif(400, 400, 3);
    const sourceMeta = await sharp(source, { animated: true }).metadata();
    expect(sourceMeta.pages).toBeGreaterThan(1); // fixture sanity check

    const out = await capGif(source);
    const meta = await sharp(out, { animated: true }).metadata();

    expect(meta.pages).toBeGreaterThan(1);
    expect(meta.width).toBeLessThanOrEqual(MEDIA_CAP_PX);
    expect(meta.pageHeight ?? meta.height).toBeLessThanOrEqual(MEDIA_CAP_PX);
  });

  it('leaves a 50x50 animated GIF unchanged in dimensions', async () => {
    const source = await makeAnimatedGif(50, 50, 2);
    const out = await capGif(source);
    const meta = await sharp(out, { animated: true }).metadata();

    expect(meta.width).toBe(50);
    expect(meta.pageHeight ?? meta.height).toBe(50);
  });

  it('outputs GIF format', async () => {
    const source = await makeAnimatedGif(60, 60, 2);
    const out = await capGif(source);
    const meta = await sharp(out, { animated: true }).metadata();

    expect(meta.format).toBe('gif');
  });
});
