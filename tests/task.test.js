// Customer Task Check: measured parts (keyboard walk, focus visibility, accessible names, contrast) with a stub
// in place of Claude, so the test is deterministic and free. The live AI element-picking is tested separately.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanDocument, applyFixesToHtml, createFetcher, withDocumentPage, closeBrowser, SAMPLE_ORIGIN } from '../src/scanner.js';
import { checkTaskOnPage, recheckTaskOnPage, announce } from '../src/taskCheck.js';

after(() => closeBrowser());
const mainUrl = `${SAMPLE_ORIGIN}/index.html`;
const sampleDir = path.resolve('samples/bakery');

// Stub that "picks" elements by matching the provided list, like Claude would.
function stubClient(pick) {
  return {
    messages: {
      create: async ({ messages }) => {
        const list = JSON.parse(messages[0].content.split('Interactive elements:\n')[1]);
        const ids = pick(list).map((e) => e.id);
        return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify({ task_found: ids.length > 0, goal_ids: ids, explanation: 'stub' }) }] };
      },
    },
  };
}

test('announce() mirrors screen-reader phrasing', () => {
  assert.equal(announce({ role: 'button', name: 'Subscribe' }), 'Subscribe, button');
  assert.equal(announce({ role: 'button', name: '' }), 'button');
  assert.equal(announce({ role: 'textbox', name: 'Your email' }), 'Your email, edit text');
});

test('task check measures real barriers, then passes after fixes (incl. invisible focus that axe cannot detect)', { timeout: 120000 }, async () => {
  const html = await fs.readFile(path.join(sampleDir, 'index.html'), 'utf8');
  const fetchResource = createFetcher({ sampleDir });
  const before = await scanDocument({ mainUrl, html, fetchResource });
  const client = stubClient((list) => list.filter((e) => e.text === 'Order a custom cake' || e.tag === 'button' || e.tag === 'select'));

  const r = await withDocumentPage({ mainUrl, html, fetchResource }, (page) => checkTaskOnPage(page, 'Order a custom cake', before.report, { client }));
  assert.equal(r.taskFound, true);
  const [kb, sr, lv] = r.result.profiles;
  assert.equal(kb.pass, false, 'invisible focus on the yellow button must be detected');
  assert.match(kb.issues.join(' '), /nothing changes on screen/);
  assert.equal(sr.pass, false, 'unnamed button and select must be detected');
  assert.equal(lv.pass, false, 'low-contrast yellow button must be detected');
  assert.ok(r.result.transcript.some((t) => t.isGoal && t.text === 'button'));
  assert.equal(r.result.taskFixes.length, 1);
  assert.equal(r.result.taskFixes[0].action, 'add_focus_style');

  const fixes = [
    ...r.result.taskFixes,
    { id: 'n1', selector: 'button', action: 'set_attribute', name: 'aria-label', value: 'Subscribe' },
    { id: 'n2', selector: 'select', action: 'set_attribute', name: 'aria-label', value: 'Offer category' },
    { id: 'c1', selector: '.btn-yellow', action: 'set_css', name: 'color', value: '#3d2a00' },
  ];
  const { fixedHtml, outcomes } = await applyFixesToHtml({ mainUrl, html, fixes });
  assert.ok(outcomes.every((o) => o.applied), JSON.stringify(outcomes));
  const afterScan = await scanDocument({ mainUrl, html: fixedHtml, fetchResource });
  const re = await withDocumentPage({ mainUrl, html: fixedHtml, fetchResource }, (page) => recheckTaskOnPage(page, r.goalIds, r.signature, afterScan.report));
  for (const p of re.profiles) assert.equal(p.pass, true, `${p.title}: ${p.issues.join(' ')}`);
  assert.ok(re.transcript.some((t) => t.text === 'Subscribe, button'));
});

test('task not on the page is reported as not found (no fake verdicts)', { timeout: 60000 }, async () => {
  const html = await fs.readFile(path.join(sampleDir, 'index.html'), 'utf8');
  const fetchResource = createFetcher({ sampleDir });
  const { report } = await scanDocument({ mainUrl, html, fetchResource });
  const r = await withDocumentPage({ mainUrl, html, fetchResource }, (page) => checkTaskOnPage(page, 'Book a hotel room', report, { client: stubClient(() => []) }));
  assert.equal(r.taskFound, false);
  assert.equal(r.result, null);
});

test('AI-chosen ids outside the element list are discarded', { timeout: 60000 }, async () => {
  const html = await fs.readFile(path.join(sampleDir, 'index.html'), 'utf8');
  const fetchResource = createFetcher({ sampleDir });
  const { report } = await scanDocument({ mainUrl, html, fetchResource });
  const bad = { messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: '{"task_found":true,"goal_ids":[9999,-1],"explanation":"x"}' }] }) } };
  const r = await withDocumentPage({ mainUrl, html, fetchResource }, (page) => checkTaskOnPage(page, 'Anything', report, { client: bad }));
  assert.equal(r.taskFound, false);
});

test('focus-style fix rejects selectors that could break out of the CSS rule', { timeout: 60000 }, async () => {
  const html = '<!DOCTYPE html><html><head></head><body><a href="#x" class="x">x</a></body></html>';
  const { outcomes, fixedHtml } = await applyFixesToHtml({
    mainUrl,
    html,
    fixes: [{ id: 'evil', selector: 'a} body{display:none', action: 'add_focus_style', name: 'outline', value: '' }],
  });
  assert.equal(outcomes[0].applied, false);
  assert.ok(!fixedHtml.includes('display:none'));
});
