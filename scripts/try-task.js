// Customer Task Check on the bakery demo: original page vs a fixed copy. Uses 1 small Haiku call per task.
// Usage: node scripts/try-task.js ["task text" ...]
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDocument, applyFixesToHtml, createFetcher, withDocumentPage, closeBrowser, SAMPLE_ORIGIN } from '../src/scanner.js';
import { checkTaskOnPage, recheckTaskOnPage } from '../src/taskCheck.js';

const tasks = process.argv.slice(2).length ? process.argv.slice(2) : ['Subscribe to offers by email', 'Follow the bakery on Instagram', 'Book a table for dinner'];
const dir = path.resolve('samples/bakery');
const mainUrl = `${SAMPLE_ORIGIN}/index.html`;
const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
const fetchResource = createFetcher({ sampleDir: dir });
const before = await scanDocument({ mainUrl, html, fetchResource });

// Known-good fixes (same kind Claude proposes) so this test isolates the task check.
const fixes = [
  { id: 'a', selector: 'button', action: 'set_attribute', name: 'aria-label', value: 'Subscribe' },
  { id: 'b', selector: 'select', action: 'set_attribute', name: 'aria-label', value: 'Offer category' },
  { id: 'c', selector: 'a[href$="instagram.com/"]', action: 'set_attribute', name: 'aria-label', value: 'Sunrise Bakery on Instagram' },
  { id: 'd', selector: 'a[href$="wa.me/"]', action: 'set_attribute', name: 'aria-label', value: 'Chat on WhatsApp' },
  { id: 'e', selector: 'img[src$="arrow.svg"]', action: 'set_attribute', name: 'alt', value: '' },
];
const { fixedHtml } = await applyFixesToHtml({ mainUrl, html, fixes });
const after = await scanDocument({ mainUrl, html: fixedHtml, fetchResource });

const show = (label, r) => {
  console.log(`  ${label}:`);
  for (const p of r.profiles) console.log(`    ${p.pass ? 'PASS' : 'FAIL'} ${p.title}${p.issues.length ? ' | ' + p.issues.join(' | ') : ''} (${p.evidence})`);
  console.log(`    hears: ${r.transcript.map((t) => (t.isGoal ? `[${t.text}]` : t.text)).join(' → ')}`);
  console.log(`    goals: ${JSON.stringify(r.goals)}`);
};

for (const task of tasks) {
  const t0 = Date.now();
  const b = await withDocumentPage({ mainUrl, html, fetchResource }, (page) => checkTaskOnPage(page, task, before.report));
  console.log(`\nTASK "${task}": found=${b.taskFound} goals=${JSON.stringify(b.goalIds)} | ${b.explanation} | $${b.usage.estimatedCostUsd} | ${Date.now() - t0} ms`);
  if (!b.taskFound) continue;
  show('BEFORE', b.result);
  const a = await withDocumentPage({ mainUrl, html: fixedHtml, fetchResource }, (page) => recheckTaskOnPage(page, b.goalIds, b.signature, after.report));
  show('AFTER ', a);
}
await closeBrowser();
