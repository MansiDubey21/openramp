import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, validatePublicUrl, safeFetch, friendlyNetworkError } from '../src/safeFetch.js';

test('network errors are explained in plain language (no bare error codes)', () => {
  assert.match(friendlyNetworkError('ENOTFOUND'), /couldn't find that website/);
  assert.ok(!friendlyNetworkError('ENOTFOUND').includes('ENOTFOUND'));
  assert.match(friendlyNetworkError('ECONNREFUSED'), /refused/);
  assert.match(friendlyNetworkError('SOMETHING_NEW'), /couldn't reach the website.*SOMETHING_NEW/);
});
import { checkContrast, suggestAccessibleColor, contrastRatio, parseColor } from '../src/contrast.js';
import { validateFix } from '../src/fixAgent.js';
import { compareReports } from '../src/report.js';
import { ContactSchema, isContactConfigured } from '../src/contact.js';

test('placeholder SMTP values from .env.example do not count as configured', () => {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    Object.assign(process.env, { SMTP_HOST: 'smtp.titan.email', SMTP_USER: 'hello@yourdomain.com', SMTP_PASS: 'REPLACE_ME', CONTACT_TO: 'hello@yourdomain.com' });
    assert.equal(isContactConfigured(), false);
    Object.assign(process.env, { SMTP_USER: 'hello@openramp.example', SMTP_PASS: 'real-secret', CONTACT_TO: 'hello@openramp.example' });
    assert.equal(isContactConfigured(), true);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test('isBlockedIp blocks private, loopback, link-local, metadata, CGNAT, IPv6 local and mapped', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1', '255.255.255.255', 'garbage']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['93.184.215.14', '8.8.8.8', '2606:4700::6810:84e5']) assert.equal(isBlockedIp(ip), false, ip);
});

test('validatePublicUrl rejects unsafe URLs', () => {
  for (const u of ['file:///etc/passwd', 'ftp://example.com', 'http://127.0.0.1/', 'http://[::1]/', 'http://0x7f000001/', 'http://2130706433/', 'http://user:pw@example.com/', 'https://example.com:8080/', 'http://intranet/', 'not a url', 'http://169.254.169.254/latest/meta-data/']) {
    assert.throws(() => validatePublicUrl(u), undefined, u);
  }
  assert.equal(validatePublicUrl('https://example.com/a?b=1').hostname, 'example.com');
});

test('safeFetch blocks hostnames that resolve to internal addresses (checked at connect time)', async () => {
  await assert.rejects(safeFetch('http://localhost/'), (e) => e.code === 'BLOCKED_URL');
});

test('contrast maths matches WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio(parseColor('#000000'), parseColor('#ffffff')) * 100) / 100, 21);
  assert.equal(checkContrast({ foreground: '#777777', background: '#ffffff', font_size_px: 16, bold: false }).passes_aa, false); // 4.48
  assert.equal(checkContrast({ foreground: '#767676', background: '#ffffff', font_size_px: 16, bold: false }).passes_aa, true); // 4.54
  assert.equal(checkContrast({ foreground: '#949494', background: '#ffffff', font_size_px: 24, bold: false }).required_ratio, 3);
  const s = suggestAccessibleColor({ foreground: '#c9a96e', background: '#ffffff', min_ratio: 4.5 });
  assert.equal(s.changed, true);
  assert.ok(checkContrast({ foreground: s.color, background: '#ffffff', font_size_px: 16, bold: false }).passes_aa);
});

test('validateFix only accepts allow-listed operations on reported selectors', () => {
  const allowed = new Set(['.logo', 'button']);
  const base = { rule_id: 'x', explanation: 'e', confidence: 'high' };
  assert.equal(validateFix({ ...base, selector: '.logo', action: 'set_attribute', name: 'alt', value: 'Sunrise Bakery' }, allowed).ok, true);
  assert.equal(validateFix({ ...base, selector: '.other', action: 'set_attribute', name: 'alt', value: 'x' }, allowed).ok, false);
  assert.equal(validateFix({ ...base, selector: '.logo', action: 'set_attribute', name: 'onerror', value: 'alert(1)' }, allowed).ok, false);
  assert.equal(validateFix({ ...base, selector: '.logo', action: 'set_attribute', name: 'src', value: 'https://evil' }, allowed).ok, false);
  assert.equal(validateFix({ ...base, selector: 'button', action: 'set_css', name: 'color', value: 'red; background:url(x)' }, allowed).ok, false);
  assert.equal(validateFix({ ...base, selector: 'button', action: 'set_css', name: 'display', value: '#000000' }, allowed).ok, false);
  assert.equal(validateFix({ ...base, selector: 'button', action: 'set_css', name: 'color', value: '#1a2b3c' }, allowed).ok, true);
  assert.equal(validateFix({ ...base, selector: 'html', action: 'set_document_title', name: '', value: 'Sunrise Bakery' }, allowed).ok, true);
  assert.equal(validateFix({ ...base, selector: 'html', action: 'set_attribute', name: 'lang', value: 'en"><script>' }, new Set(['html'])).ok, false);
  assert.equal(validateFix({ ...base, selector: '.logo', action: 'remove_element', name: '', value: '' }, allowed).ok, false);
});

test('compareReports computes before/after per rule', () => {
  const mk = (pairs) => ({ issueCount: pairs.reduce((s, [, n]) => s + n, 0), violations: pairs.map(([id, n]) => ({ id, help: id, nodes: Array(n).fill({}) })) });
  const c = compareReports(mk([['image-alt', 5], ['color-contrast', 9]]), mk([['color-contrast', 1]]));
  assert.equal(c.beforeTotal, 14);
  assert.equal(c.afterTotal, 1);
  assert.equal(c.fixedCount, 13);
  assert.deepEqual(c.newIssues, []);
});

test('contact form validation', () => {
  assert.equal(ContactSchema.safeParse({ name: 'A', email: 'bad', message: 'hello there friend' }).success, false);
  assert.equal(ContactSchema.safeParse({ name: '', email: 'a@b.co', message: 'hello there friend' }).success, false);
  assert.equal(ContactSchema.safeParse({ name: 'A', email: 'a@b.co', message: 'short' }).success, false);
  assert.equal(ContactSchema.safeParse({ name: 'A', email: 'a@b.co', message: 'hello there friend' }).success, true);
});
