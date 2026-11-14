// One-off helper: renders simple SVG illustrations to PNG with Playwright so the demo site has
// real raster images (Claude vision accepts PNG/JPEG/GIF/WebP, not SVG).
// Usage: node scripts/make-sample-images.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('samples/bakery/images');

const art = {
  'cake.png': { w: 520, h: 360, svg: `
    <rect width="520" height="360" fill="#f6e7d0"/>
    <ellipse cx="260" cy="300" rx="200" ry="26" fill="#d9c3a5"/>
    <rect x="110" y="170" width="300" height="120" rx="14" fill="#5a3216"/>
    <rect x="110" y="170" width="300" height="34" rx="14" fill="#7a4521"/>
    <path d="M110 200 q25 30 50 0 q25 30 50 0 q25 30 50 0 q25 30 50 0 q25 30 50 0 q25 30 50 0" fill="#7a4521"/>
    <circle cx="170" cy="185" r="9" fill="#d62839"/><circle cx="260" cy="182" r="9" fill="#d62839"/><circle cx="350" cy="185" r="9" fill="#d62839"/>
    ${[200, 240, 280, 320].map((x) => `<rect x="${x}" y="110" width="10" height="60" fill="#fdfdfd" stroke="#e86f9c" stroke-width="3"/><path d="M${x + 5} 92 q10 12 0 20 q-10 -8 0 -20" fill="#ffb703"/>`).join('')}
    <text x="260" y="250" font-family="Georgia" font-size="30" fill="#f6e7d0" text-anchor="middle">Happy Birthday</text>` },
  'bread.png': { w: 520, h: 360, svg: `
    <rect width="520" height="360" fill="#efe6da"/>
    <rect x="40" y="260" width="440" height="40" rx="6" fill="#a47148"/>
    <ellipse cx="260" cy="200" rx="180" ry="90" fill="#c68642"/>
    <ellipse cx="260" cy="185" rx="165" ry="75" fill="#d9a066"/>
    <path d="M150 160 q40 30 80 0 M220 150 q40 30 80 0 M290 160 q40 30 80 0" stroke="#f3dcb5" stroke-width="10" fill="none" stroke-linecap="round"/>
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${130 + ((i * 37) % 260)}" cy="${150 + ((i * 23) % 80)}" r="2" fill="#f7e9cf"/>`).join('')}` },
  'logo.png': { w: 300, h: 96, svg: `
    <rect width="300" height="96" fill="#ffffff"/>
    <circle cx="48" cy="56" r="26" fill="#ffb703"/>
    ${[0, 30, 60, 90, 120, 150, 180].map((a) => `<line x1="${48 + 32 * Math.cos((Math.PI * (180 + a)) / 180)}" y1="${56 + 32 * Math.sin((Math.PI * (180 + a)) / 180)}" x2="${48 + 44 * Math.cos((Math.PI * (180 + a)) / 180)}" y2="${56 + 44 * Math.sin((Math.PI * (180 + a)) / 180)}" stroke="#ffb703" stroke-width="4"/>`).join('')}
    <rect x="10" y="56" width="80" height="40" fill="#ffffff"/>
    <text x="100" y="62" font-family="Georgia" font-size="30" fill="#6b3e1e">Sunrise Bakery</text>` },
};

const browser = await chromium.launch();
const page = await browser.newPage();
await fs.mkdir(outDir, { recursive: true });
for (const [name, { w, h, svg }] of Object.entries(art)) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg></body></html>`);
  await page.screenshot({ path: path.join(outDir, name), clip: { x: 0, y: 0, width: w, height: h } });
  console.log('wrote', name);
}
await fs.writeFile(path.join(outDir, 'arrow.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12h14M12 5l7 7-7 7" stroke="#fff" stroke-width="2.5" fill="none"/></svg>');
await fs.writeFile(path.join(outDir, 'insta.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="2" fill="none"/></svg>');
console.log('wrote arrow.svg, insta.svg');
await browser.close();
