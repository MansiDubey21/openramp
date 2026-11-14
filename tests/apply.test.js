// Deterministic test of apply → re-scan using hand-written fixes (no AI), plus OpenRamp's own page.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanDocument, applyFixesToHtml, createFetcher, closeBrowser, SAMPLE_ORIGIN } from '../src/scanner.js';
import { compareReports } from '../src/report.js';

after(() => closeBrowser());
const mainUrl = `${SAMPLE_ORIGIN}/index.html`;

test('approved fixes applied to a copy measurably reduce issues on re-scan', { timeout: 120000 }, async () => {
  const sampleDir = path.resolve('samples/bakery');
  const html = await fs.readFile(path.join(sampleDir, 'index.html'), 'utf8');
  const fetchResource = createFetcher({ sampleDir });
  const before = await scanDocument({ mainUrl, html, fetchResource });

  const fixes = [
    { id: 'f1', selector: 'html', action: 'set_attribute', name: 'lang', value: 'en' },
    { id: 'f2', selector: 'html', action: 'set_document_title', name: '', value: 'Sunrise Bakery, Pune' },
    { id: 'f3', selector: '.logo', action: 'set_attribute', name: 'alt', value: 'Sunrise Bakery' },
    { id: 'f4', selector: 'button', action: 'set_attribute', name: 'aria-label', value: 'Subscribe' },
    { id: 'f5', selector: 'select', action: 'set_attribute', name: 'aria-label', value: 'Offers you are interested in' },
    { id: 'f6', selector: '.tagline', action: 'set_css', name: 'color', value: '#6b5a44' },
    { id: 'f7', selector: '#does-not-exist', action: 'set_attribute', name: 'alt', value: 'x' },
  ];
  const { fixedHtml, outcomes } = await applyFixesToHtml({ mainUrl, html, fixes });
  assert.equal(outcomes.find((o) => o.id === 'f7').applied, false, 'missing element reported, not silently ignored');
  assert.ok(outcomes.filter((o) => o.applied).length === 6);
  assert.match(fixedHtml, /<html lang="en">/);
  assert.match(fixedHtml, /<title>Sunrise Bakery, Pune<\/title>/);

  const afterScan = await scanDocument({ mainUrl, html: fixedHtml, fetchResource });
  const c = compareReports(before.report, afterScan.report);
  const ids = afterScan.report.violations.map((v) => v.id);
  for (const gone of ['html-has-lang', 'document-title', 'button-name', 'select-name']) assert.ok(!ids.includes(gone), `${gone} should be fixed`);
  assert.equal(c.afterTotal, c.beforeTotal - 6, `before ${c.beforeTotal}, after ${c.afterTotal}`);
  assert.deepEqual(c.newIssues, []);
});

test('fix values cannot inject markup (DOM APIs only)', { timeout: 60000 }, async () => {
  const html = '<!DOCTYPE html><html><head></head><body><img src="a.png" class="x"></body></html>';
  const { fixedHtml } = await applyFixesToHtml({ mainUrl, html, fixes: [{ id: 'a', selector: '.x', action: 'set_attribute', name: 'alt', value: '"><script>alert(1)</script>' }] });
  assert.ok(!/<script>alert/.test(fixedHtml), 'value must be attribute-escaped');
});

test("OpenRamp's own page has zero automatically detectable WCAG A/AA issues", { timeout: 60000 }, async () => {
  const publicDir = path.resolve('public');
  const html = await fs.readFile(path.join(publicDir, 'index.html'), 'utf8');
  const { report } = await scanDocument({ mainUrl, html, fetchResource: createFetcher({ sampleDir: publicDir }) });
  assert.equal(report.issueCount, 0, JSON.stringify(report.violations.map((v) => [v.id, v.nodes.map((n) => n.selector)])));
});
