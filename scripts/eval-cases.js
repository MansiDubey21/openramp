// Real-case evaluation: scan → Claude proposals → apply ALL proposals to a copy → re-scan.
// Writes data/eval-<timestamp>.json (git-ignored) and prints a summary table.
// Costs real API credit (roughly $0.05–0.15 per page with issues). Usage: node scripts/eval-cases.js
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDocument, applyFixesToHtml, createFetcher, fetchMainDocument, closeBrowser, SAMPLE_ORIGIN } from '../src/scanner.js';
import { proposeFixes } from '../src/fixAgent.js';
import { compareReports } from '../src/report.js';

const CASES = [
  { name: 'Bakery demo (bundled)', sample: true },
  { name: 'W3C BAD demo: home (before)', url: 'https://www.w3.org/WAI/demos/bad/before/home.html' },
  { name: 'W3C BAD demo: news (before)', url: 'https://www.w3.org/WAI/demos/bad/before/news.html' },
  { name: 'W3C BAD demo: tickets (before)', url: 'https://www.w3.org/WAI/demos/bad/before/tickets.html' },
  { name: 'W3C BAD demo: survey (before)', url: 'https://www.w3.org/WAI/demos/bad/before/survey.html' },
  { name: 'W3C BAD demo: home (after, control)', url: 'https://www.w3.org/WAI/demos/bad/after/home.html' },
  { name: 'example.com (control)', url: 'https://example.com/' },
  { name: 'UW AccessComputing inaccessible demo', url: 'https://www.washington.edu/accesscomputing/AU/before.html' },
  { name: 'Wikipedia article', url: 'https://en.wikipedia.org/wiki/Accessibility' },
  { name: 'GOV.UK home', url: 'https://www.gov.uk/' },
];

const results = [];
let totalCost = 0;
for (const c of CASES) {
  const row = { name: c.name, url: c.url || 'sample' };
  try {
    let mainUrl, html, fetchResource;
    if (c.sample) {
      const dir = path.resolve('samples/bakery');
      mainUrl = `${SAMPLE_ORIGIN}/index.html`;
      html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
      fetchResource = createFetcher({ sampleDir: dir });
    } else {
      const doc = await fetchMainDocument(c.url);
      ({ finalUrl: mainUrl, html } = doc);
      fetchResource = createFetcher();
    }
    const scan = await scanDocument({ mainUrl, html, fetchResource });
    row.before = scan.report.issueCount;
    row.rules = scan.report.violations.map((v) => `${v.id}:${v.nodes.length}`).join(' ');
    if (!scan.report.issueCount) {
      row.note = 'No issues: AI not called';
      results.push(row);
      console.log(`✔ ${c.name}: 0 issues, AI skipped`);
      continue;
    }
    const p = await proposeFixes(scan);
    totalCost += p.usage.estimatedCostUsd;
    const { fixedHtml, outcomes } = await applyFixesToHtml({ mainUrl, html, fixes: p.fixes });
    const re = await scanDocument({ mainUrl, html: fixedHtml, fetchResource });
    const cmp = compareReports(scan.report, re.report);
    Object.assign(row, {
      fixes: p.fixes.length,
      applied: outcomes.filter((o) => o.applied).length,
      rejected: p.rejected.length,
      needsHuman: p.needsHuman.length,
      notSent: p.notSentCount,
      after: cmp.afterTotal,
      newIssueTypes: cmp.newIssues,
      cost: p.usage.estimatedCostUsd,
      remaining: cmp.rows.filter((r) => r.after > 0).map((r) => `${r.ruleId}:${r.after}`).join(' '),
      sampleFixes: p.fixes.slice(0, 50).map((f) => ({ rule: f.rule_id, sel: f.selector, change: `${f.action} ${f.name}=${f.value}`, conf: f.confidence, why: f.explanation })),
      needsHumanDetail: p.needsHuman,
      rejectedDetail: p.rejected.map((r) => r.reason),
    });
    console.log(`✔ ${c.name}: ${row.before} → ${row.after} | fixes ${row.fixes} (applied ${row.applied}, rejected ${row.rejected}) | human ${row.needsHuman} | not sent ${row.notSent} | new types: ${row.newIssueTypes.join(',') || 'none'} | $${row.cost}`);
  } catch (e) {
    row.error = `${e.code || e.name}: ${e.message}`;
    console.log(`✖ ${c.name}: ${row.error}`);
  }
  results.push(row);
}
await closeBrowser();
await fs.mkdir('data', { recursive: true });
const file = path.join('data', `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await fs.writeFile(file, JSON.stringify({ model: process.env.FIX_MODEL || 'claude-sonnet-5-5', totalCost, results }, null, 2));
console.log(`Total estimated AI cost: $${totalCost.toFixed(4)} | saved ${file}`);
