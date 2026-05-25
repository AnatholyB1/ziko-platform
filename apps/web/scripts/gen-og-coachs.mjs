// TODO: replace with designed PNG before go-live (spec: #1C1A17 bg, ZIKO white 72px, subtitle orange 40px, 1200x630)
// Generates a minimal valid 1200x630 PNG with solid dark background (#1C1A17)
// No external image library required — uses raw PNG binary format with zlib compression

import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const WIDTH = 1200
const HEIGHT = 630

// Background color: #1C1A17
const R = 0x1C
const G = 0x1A
const B = 0x17

// Build raw pixel data: each row is a filter byte (0x00 = None) followed by RGB triplets
const rowSize = 1 + WIDTH * 3
const rawData = new Uint8Array(HEIGHT * rowSize)

for (let y = 0; y < HEIGHT; y++) {
  const rowOffset = y * rowSize
  rawData[rowOffset] = 0x00 // filter type: None
  for (let x = 0; x < WIDTH; x++) {
    const pixelOffset = rowOffset + 1 + x * 3
    rawData[pixelOffset] = R
    rawData[pixelOffset + 1] = G
    rawData[pixelOffset + 2] = B
  }
}

// Compress pixel data with zlib (deflate)
const compressed = deflateSync(Buffer.from(rawData))

// PNG helper: 4-byte big-endian integer
function uint32BE(val) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(val >>> 0, 0)
  return buf
}

// CRC32 table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[i] = c
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const lenBuf = uint32BE(dataBuf.length)
  const crcInput = Buffer.concat([typeBuf, dataBuf])
  const crcBuf = uint32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf])
}

// PNG signature
const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

// IHDR chunk: width, height, bit depth (8), color type (2=RGB), compression (0), filter (0), interlace (0)
const ihdrData = Buffer.concat([
  uint32BE(WIDTH),
  uint32BE(HEIGHT),
  Buffer.from([8, 2, 0, 0, 0]),
])

// IDAT chunk: compressed pixel data
const idatData = compressed

// IEND chunk (empty)
const iendData = Buffer.alloc(0)

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdrData),
  chunk('IDAT', idatData),
  chunk('IEND', iendData),
])

const outPath = resolve(__dirname, '../public/og-coachs.png')
writeFileSync(outPath, png)

const kb = (png.length / 1024).toFixed(1)
console.log(`Generated og-coachs.png — ${WIDTH}x${HEIGHT} — ${kb} KB`)
console.log(`Path: ${outPath}`)
