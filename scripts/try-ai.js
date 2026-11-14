// Runs the full pipeline (scan → Claude proposals → apply all → re-scan) on real pages and prints results + cost.
// Requires ANTHROPIC_API_KEY in .env. Costs a few cents per page.  Usage: node scripts/try-ai.js [sample|w3c|<url>]
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDocument, applyFixesToHtml, createFetcher, fetchMainDocument, closeBrowser, SAMPLE_ORIGIN } from '../src/scanner.js';
import { proposeFixes } from '../src/fixAgent.js';
import { compareReports } from '../src/report.js';

const which = process.argv[2] || 'sample';
let mainUrl, html, fetchResource;
if (which === 'sample') {
  const dir = path.resolve('samples/bakery');
  mainUrl = `${SAMPLE_ORIGIN}/index.html`;
  html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
  fetchResource = createFetcher({ sampleDir: dir });
} else {
  const doc = await fetchMainDocument(which === 'w3c' ? 'https://www.w3.org/WAI/demos/bad/before/home.html' : which);
  ({ finalUrl: mainUrl, html } = doc);
  fetchResource = createFetcher();
}

const t0 = Date.now();
const scan = await scanDocument({ mainUrl, html, fetchResource });
console.log(`Scan: ${scan.report.issueCount} issues in ${scan.report.ruleCount} rules (${Date.now() - t0} ms)`);
const t1 = Date.now();
const proposal = await proposeFixes(scan);
console.log(`AI: ${proposal.fixes.length} fixes, ${proposal.needsHuman.length} need a human, ${proposal.rejected.length} rejected by validator, ${proposal.notSentCount} not sent to AI (${Date.now() - t1} ms)`);
for (const f of proposal.fixes) console.log(`  [${f.confidence}] ${f.rule_id} ${f.selector}: ${f.action} ${f.name}=${JSON.stringify(f.value)}`);
for (const n of proposal.needsHuman) console.log(`  [human] ${n.rule_id} ${n.selector}: ${n.reason}`);
for (const r of proposal.rejected) console.log(`  [rejected] ${r.reason}: ${JSON.stringify(r.fix).slice(0, 160)}`);
console.log('Usage:', proposal.usage);

const { fixedHtml, outcomes } = await applyFixesToHtml({ mainUrl, html, fixes: proposal.fixes });
const rescan = await scanDocument({ mainUrl, html: fixedHtml, fetchResource });
const c = compareReports(scan.report, rescan.report);
console.log(`Applied ${outcomes.filter((o) => o.applied).length}/${outcomes.length}. Before ${c.beforeTotal} → after ${c.afterTotal}. New issue types: ${c.newIssues.join(', ') || 'none'}`);
for (const r of c.rows) console.log(`  ${r.ruleId}: ${r.before} → ${r.after}`);
await closeBrowser();
