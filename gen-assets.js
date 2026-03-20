#!/usr/bin/env node
// Ziko Asset Generator — pure Node.js, no dependencies
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ─────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG builder ───────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcVal = crc32(Buffer.concat([t, data]));
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, t, data, crcBuf]);
}

function makePNG(w, h, getPixel) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = 1 + w * 3;
  const raw = Buffer.allocUnsafe(h * stride);

  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const [r, g, b] = getPixel(x, y);
      const i = y * stride + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  return Buffer.concat([
    SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Geometry helpers ──────────────────────────────────────
// Signed distance to filled rect: negative = inside, positive = outside
function sdfRect(px, py, x1, y1, x2, y2) {
  if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
    return -Math.min(px - x1, x2 - px, py - y1, y2 - py);
  }
  const dx = Math.max(x1 - px, 0, px - x2);
  const dy = Math.max(y1 - py, 0, py - y2);
  return Math.hypot(dx, dy);
}

// Unsigned distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Returns [0,1] blend factor: 1 = fully inside Z glyph
const AA = 1.2; // anti-alias radius in pixels

function zBlend(px, py, cx, cy, imgSize) {
  const lw = imgSize * 0.55;
  const lh = imgSize * 0.55;
  const lx = cx - lw * 0.5;
  const ly = cy - lh * 0.5;
  const sw = lw * 0.14; // stroke width

  const topBar  = sdfRect(px, py, lx, ly, lx + lw, ly + sw);
  const botBar  = sdfRect(px, py, lx, ly + lh - sw, lx + lw, ly + lh);
  const diagRaw = distToSegment(px, py, lx + lw, ly + sw, lx, ly + lh - sw);
  const diag    = diagRaw - sw * 0.5;

  const minDist = Math.min(topBar, botBar, diag);
  if (minDist <= 0) return 1;
  if (minDist < AA) return 1 - minDist / AA;
  return 0;
}

// ── Color helpers ─────────────────────────────────────────
const PURPLE = [108, 99, 255];
const DARK   = [15, 15, 20];
const WHITE  = [255, 255, 255];

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ── Pixel functions ───────────────────────────────────────

// Icon / adaptive-icon: radial gradient purple bg + white Z + subtle inner glow
function iconPixel(size) {
  const cx = size / 2, cy = size / 2;
  const maxR = Math.hypot(cx, cy);
  return (px, py) => {
    const dist = Math.hypot(px - cx, py - cy);
    const t = dist / maxR;
    // Slightly lighter purple at center
    const bg = lerp([130, 122, 255], PURPLE, Math.min(t * 1.4, 1));
    const blend = zBlend(px, py, cx, cy, size);
    return lerp(bg, WHITE, blend);
  };
}

// Splash: dark bg, soft purple radial glow, white Z
function splashPixel(w, h) {
  const cx = w / 2, cy = h / 2;
  const glowR = Math.min(w, h) * 0.55;
  return (px, py) => {
    const dist = Math.hypot(px - cx, py - cy);
    const t = Math.max(0, 1 - dist / glowR);
    const easedT = t * t * (3 - 2 * t); // smoothstep
    const bg = lerp(DARK, [50, 45, 120], easedT * 0.6);
    const blend = zBlend(px, py, cx, cy, Math.min(w, h) * 0.55);
    return lerp(bg, WHITE, blend);
  };
}

// Favicon: simple solid purple + white Z
function faviconPixel(size) {
  const cx = size / 2, cy = size / 2;
  return (px, py) => {
    const blend = zBlend(px, py, cx, cy, size * 0.85);
    return lerp(PURPLE, WHITE, blend);
  };
}

// ── Write files ───────────────────────────────────────────
const dir = path.join(__dirname, 'apps/mobile/assets/images');
fs.mkdirSync(dir, { recursive: true });

const assets = [
  { name: 'icon.png',          gen: () => makePNG(1024, 1024, iconPixel(1024)) },
  { name: 'splash.png',        gen: () => makePNG(1024, 1024, splashPixel(1024, 1024)) },
  { name: 'adaptive-icon.png', gen: () => makePNG(1024, 1024, iconPixel(1024)) },
  { name: 'favicon.png',       gen: () => makePNG(48,   48,   faviconPixel(48)) },
];

for (const { name, gen } of assets) {
  process.stdout.write(`  Generating ${name.padEnd(22)}`);
  const t0 = Date.now();
  const buf = gen();
  fs.writeFileSync(path.join(dir, name), buf);
  console.log(`${(buf.length / 1024).toFixed(1).padStart(7)} KB  (${Date.now() - t0}ms)`);
}

console.log(`\nDone → ${dir}`);
