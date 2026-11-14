import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts, writeOwnerSummary, LangSchema } from '../src/ownerSummary.js';

const session = {
  target: 'Demo bakery',
  before: {
    issueCount: 21,
    byImpact: { critical: 7, serious: 13, moderate: 1, minor: 0 },
    needsReviewCount: 0,
    violations: [{ help: 'Images must have alternative text', impact: 'critical', nodes: [{}, {}, {}, {}, {}] }],
  },
  task: { text: 'Order a cake', taskFound: true, before: { profiles: [{ title: 'Keyboard-only customer', pass: false, issues: ['x'] }] } },
  after: { issueCount: 0 },
  proposal: { needsHuman: [{}, {}] },
};

const stub = (text) => ({ messages: { create: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text }] }) } });

test('facts come from real results, including task and re-scan', () => {
  const f = buildFacts(session);
  assert.equal(f.issues_found, 21);
  assert.equal(f.top_problems[0].elements, 5);
  assert.equal(f.customer_task.before_fixes[0].can_complete, false);
  assert.deepEqual(f.after_approved_fixes, { issues_remaining: 0, issues_resolved: 21 });
  assert.equal(f.issues_ai_could_not_fix_safely, 2);
});

test('only supported languages are accepted', () => {
  assert.equal(LangSchema.safeParse('hi').success, true);
  assert.equal(LangSchema.safeParse('en').success, true);
  assert.equal(LangSchema.safeParse('xx').success, false);
});

test('valid summary is returned with language tag; malformed output is rejected', async () => {
  const ok = await writeOwnerSummary(session, 'hi', { client: stub(JSON.stringify({ headline: 'शीर्षक', summary: 'सारांश', next_steps: ['एक', 'दो', 'तीन'] })) });
  assert.equal(ok.bcp47, 'hi');
  assert.equal(ok.next_steps.length, 3);
  await assert.rejects(writeOwnerSummary(session, 'en', { client: stub('not json') }), (e) => e.code === 'BAD_OUTPUT');
  await assert.rejects(writeOwnerSummary(session, 'en', { client: stub(JSON.stringify({ headline: '', summary: 'x', next_steps: [] })) }), (e) => e.code === 'BAD_OUTPUT');
});
