// Dev helper: scan the bundled sample site from the command line. Usage: node scripts/try-scan.js
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDocument, createFetcher, SAMPLE_ORIGIN, closeBrowser } from '../src/scanner.js';

const sampleDir = path.resolve('samples/bakery');
const html = await fs.readFile(path.join(sampleDir, 'index.html'), 'utf8');
const { report, pageInfo, imageCandidates } = await scanDocument({
  mainUrl: `${SAMPLE_ORIGIN}/index.html`,
  html,
  fetchResource: createFetcher({ sampleDir }),
});
console.log(report.engine, '| issues:', report.issueCount, '| rules:', report.ruleCount, '| byImpact:', report.byImpact, '| needsReview:', report.needsReviewCount);
for (const v of report.violations) console.log(`- ${v.id} [${v.impact}] x${v.nodes.length}: ${v.nodes.map((n) => n.selector).join(', ')}`);
console.log('pageInfo.lang:', JSON.stringify(pageInfo.lang), 'title:', JSON.stringify(pageInfo.title), 'text chars:', pageInfo.text.length);
console.log('images for vision:', imageCandidates.map((i) => `${i.selector} -> ${i.mediaType} ${i.base64.length}b64`));
await closeBrowser();
