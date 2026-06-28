const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
const outputDir = path.join(__dirname, '..', 'public', 'icons');

async function generate() {
  const svg = fs.readFileSync(svgPath);

  await sharp(svg).resize(192, 192).png().toFile(path.join(outputDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  await sharp(svg).resize(512, 512).png().toFile(path.join(outputDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  await sharp(svg).resize(512, 512).png().toFile(path.join(outputDir, 'icon-maskable-512.png'));
  console.log('Created icon-maskable-512.png');

  // Generate a simple screenshot placeholder (390x844 solid color with text)
  const screenshotSvg = `<svg width="390" height="844" xmlns="http://www.w3.org/2000/svg">
    <rect width="390" height="844" fill="#4f46e5"/>
    <text x="195" y="400" font-family="Arial" font-size="32" fill="white" text-anchor="middle">Avento</text>
    <text x="195" y="450" font-family="Arial" font-size="16" fill="#c7d2fe" text-anchor="middle">People Presence Platform</text>
  </svg>`;
  await sharp(Buffer.from(screenshotSvg)).resize(390, 844).png().toFile(path.join(outputDir, 'screenshot-mobile.png'));
  console.log('Created screenshot-mobile.png');
}

generate().catch(console.error);
