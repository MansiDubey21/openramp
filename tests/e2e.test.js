// End-to-end tests against a real running server (no AI calls: those need an API key and cost money).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

before(async () => {
  proc = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: '', SMTP_HOST: '' }, stdio: 'pipe' });
  for (let i = 0; i < 300; i++) { // up to 60 s: startup is much slower while Docker Desktop is running
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});
after(() => proc?.kill());

const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

let scanId;
test('demo scan returns real axe-core findings with evidence', { timeout: 120000 }, async () => {
  const res = await post('/api/scan', { sample: 'bakery' });
  assert.equal(res.status, 200);
  const data = await res.json();
  scanId = data.scanId;
  assert.match(data.before.engine, /^axe-core/);
  assert.ok(data.before.issueCount >= 15, `expected many issues, got ${data.before.issueCount}`);
  const ids = data.before.violations.map((v) => v.id);
  for (const id of ['image-alt', 'color-contrast', 'html-has-lang', 'document-title', 'button-name', 'link-name']) assert.ok(ids.includes(id), id);
  const node = data.before.violations[0].nodes[0];
  assert.ok(node.selector && node.html && node.failureSummary, 'evidence present');
  assert.match(data.disclaimer, /not a WCAG conformance/);
});

test('SSRF attempts are rejected by the API', async () => {
  for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://localhost:3999/', 'http://[::1]/', 'file:///etc/passwd', 'http://10.0.0.5/']) {
    const res = await post('/api/scan', { url });
    assert.equal(res.status, 400, url);
  }
});

test('propose without API key fails clearly (no fake fixes)', async () => {
  const res = await post(`/api/scan/${scanId}/propose`, {});
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /not configured/);
});

test('apply requires proposals first, unknown scans 404', async () => {
  assert.equal((await post(`/api/scan/${scanId}/apply`, { fixIds: ['fix-1'] })).status, 404);
  assert.equal((await post('/api/scan/does-not-exist/apply', { fixIds: ['fix-1'] })).status, 404);
});

test('contact form: invalid input rejected, unconfigured SMTP reported honestly, honeypot silently accepted', async () => {
  assert.equal((await post('/api/contact', { name: 'A', email: 'bad', message: 'hello there friend' })).status, 400);
  assert.equal((await post('/api/contact', { name: 'A', email: 'a@example.com', message: 'hello there friend' })).status, 503);
  assert.equal((await post('/api/contact', { name: 'Bot', email: 'a@example.com', message: 'buy cheap stuff now', website: 'spam' })).status, 200);
});

test('security headers present on the home page', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy') || '', /script-src 'self'/);
  // Regression: this directive broke all CSS/JS when the site was served over plain HTTP (VPS IP mode).
  assert.doesNotMatch(res.headers.get('content-security-policy') || '', /upgrade-insecure-requests/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});
