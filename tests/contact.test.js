// End-to-end contact form test: real server process → nodemailer → a local SMTP server (no external mail service).
// Proves the SMTP path works with authentication; real Titan delivery is tested after the mailbox exists.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { SMTPServer } from 'smtp-server';

const PORT = 3995;
const BASE = `http://127.0.0.1:${PORT}`;
const USER = 'hello@openramp.test';
const PASS = 'test-only-password';
const received = [];
let smtp;
let smtpPort;
let proc;

before(async () => {
  smtp = new SMTPServer({
    secure: false,
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true, // local test only; production uses TLS on port 465
    onAuth(auth, _session, cb) {
      if (auth.username === USER && auth.password === PASS) return cb(null, { user: auth.username });
      return cb(new Error('Invalid username or password'));
    },
    onData(stream, session, cb) {
      let raw = '';
      stream.on('data', (c) => (raw += c));
      stream.on('end', () => {
        received.push({ raw, rcpt: session.envelope.rcptTo.map((r) => r.address), user: session.user });
        cb();
      });
    },
  });
  await new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  smtpPort = smtp.server.address().port;

  proc = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: 'false',
      SMTP_USER: USER,
      SMTP_PASS: PASS,
      CONTACT_TO: USER,
    },
    stdio: 'pipe',
  });
  for (let i = 0; i < 300; i++) { // up to 60 s under heavy load (e.g. Docker Desktop running)
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(async () => {
  proc?.kill();
  await new Promise((r) => smtp?.close(r));
});

const post = (body) => fetch(`${BASE}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('health reports contact configured when real (non-placeholder) settings are present', async () => {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(h.contact, true);
});

test('a valid message is delivered via authenticated SMTP to the business mailbox', async () => {
  const res = await post({ name: 'Asha Patil', email: 'asha@example.com', message: 'Do you make eggless cakes for 20 people?' });
  assert.equal(res.status, 200, await res.text());
  const m = received.at(-1);
  assert.ok(m, 'message received by SMTP server');
  assert.equal(m.user, USER, 'authenticated with the mailbox user');
  assert.deepEqual(m.rcpt, [USER]);
  assert.match(m.raw, /Subject: OpenRamp contact: Asha Patil/);
  assert.match(m.raw, /Reply-To: .*asha@example\.com/);
  assert.match(m.raw, /eggless cakes for 20 people/);
});

test('header injection via the name field is neutralised', async () => {
  const before = received.length;
  const res = await post({ name: 'Eve\r\nBcc: victim@example.com', email: 'eve@example.com', message: 'Trying to add a Bcc header here.' });
  assert.equal(res.status, 200);
  const m = received[before];
  assert.ok(m);
  assert.ok(!/^Bcc:/im.test(m.raw), 'no injected Bcc header');
  assert.deepEqual(m.rcpt, [USER], 'only the business mailbox receives it');
});

test('honeypot submissions are not sent', async () => {
  const before = received.length;
  const res = await post({ name: 'Bot', email: 'bot@example.com', message: 'cheap pills cheap pills', website: 'http://spam' });
  assert.equal(res.status, 200);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(received.length, before);
});
