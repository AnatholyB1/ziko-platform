const sharp = require('sharp')
const path = require('path')

const width = 220
const height = 440

const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" style="stop-color:#FF5C1A;stop-opacity:1" />
        <stop offset="60%" style="stop-color:#FFB199;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#F7F6F3;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)" rx="30" />
  </svg>
`

const outputPath = path.join(__dirname, '..', 'public', 'app-screenshot-placeholder.png')

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => console.log('Generated:', outputPath))
  .catch(err => { console.error(err); process.exit(1) })
