#!/usr/bin/env node
// Generates public/og-image.png — 1200x630px static OG image
// Run: node scripts/generate-og-image.js
// Requires: sharp (devDependency)

const sharp = require('sharp')
const path = require('path')

const width = 1200
const height = 630

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F7F6F3;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF5C1A;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF8C5A;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <!-- Orange accent bar top -->
  <rect x="0" y="0" width="${width}" height="12" fill="url(#accentGrad)" />
  <!-- Decorative circles -->
  <circle cx="1050" cy="80" r="280" fill="#FF5C1A" opacity="0.08" />
  <circle cx="1100" cy="550" r="180" fill="#FF5C1A" opacity="0.06" />
  <!-- Brand name -->
  <text x="80" y="280" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="900" fill="#FF5C1A" letter-spacing="-4">Ziko</text>
  <!-- Tagline -->
  <text x="80" y="360" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="400" fill="#1C1A17">L'appli fitness tout-en-un</text>
  <!-- Sub-tagline -->
  <text x="80" y="420" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="300" fill="#6B6963">Coaching IA  •  GPS Running  •  17 Plugins</text>
  <!-- Badge -->
  <rect x="80" y="468" width="260" height="52" rx="26" fill="#FF5C1A" />
  <text x="210" y="502" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle">Gratuit pour toujours</text>
</svg>`

const outputPath = path.join(__dirname, '..', 'public', 'og-image.png')

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then((info) => console.log(`Generated: ${outputPath} (${info.size} bytes)`))
  .catch((err) => { console.error(err); process.exit(1) })
