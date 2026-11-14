import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fetchMainDocument, scanDocument, applyFixesToHtml, createFetcher, closeBrowser, withDocumentPage, SAMPLE_ORIGIN } from './scanner.js';
import { checkTaskOnPage, recheckTaskOnPage, TaskCheckError, TaskInputSchema } from './taskCheck.js';
import { writeOwnerSummary, SummaryError, LangSchema } from './ownerSummary.js';
import { SafeFetchError } from './safeFetch.js';
import { proposeFixes, FixAgentError } from './fixAgent.js';
import { createSession, getSession } from './sessions.js';
import { compareReports, renderReportHtml, DISCLAIMER } from './report.js';
import { sendContactMessage, isContactConfigured } from './contact.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_DIR = path.join(root, 'samples', 'bakery');
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: '50kb' }));

const limiter = (windowMin, limit) =>
  rateLimit({ windowMs: windowMin * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please wait a few minutes and try again.' } });

// Only a couple of browser scans at once, to protect server memory.
let activeScans = 0;
const MAX_ACTIVE_SCANS = 2;
async function withScanSlot(fn) {
  if (activeScans >= MAX_ACTIVE_SCANS) throw Object.assign(new Error('busy'), { code: 'BUSY' });
  activeScans++;
  try {
    return await fn();
  } finally {
    activeScans--;
  }
}

function sendError(res, e) {
  if (e instanceof SafeFetchError) return res.status(400).json({ error: e.message, code: e.code });
  if (e instanceof FixAgentError || e instanceof TaskCheckError || e instanceof SummaryError) {
    return res.status(e.code === 'NOT_CONFIGURED' ? 503 : e.code === 'NO_ELEMENTS' ? 400 : 502).json({ error: e.message, code: e.code });
  }
  if (e?.code === 'BUSY') return res.status(503).json({ error: 'The scanner is busy with other sites. Please try again in a moment.' });
  if (/Timeout|net::ERR/i.test(String(e?.message))) return res.status(400).json({ error: 'The page could not be loaded in time.' });
  console.error('[error]', e?.name, e?.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

const publicSession = (s) => ({ scanId: s.id, target: s.target, isSample: s.isSample, before: s.before, disclaimer: DISCLAIMER });

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY), contact: isContactConfigured() }));

// 1) Scan a public URL or the bundled demo site with axe-core.
app.post('/api/scan', limiter(10, 10), async (req, res) => {
  try {
    const isSample = req.body?.sample === 'bakery';
    let mainUrl, html, fetchResource, target;
    if (isSample) {
      mainUrl = `${SAMPLE_ORIGIN}/index.html`;
      html = await fs.readFile(path.join(SAMPLE_DIR, 'index.html'), 'utf8');
      fetchResource = createFetcher({ sampleDir: SAMPLE_DIR });
      target = 'Demo: Sunrise Bakery (sample site)';
    } else {
      const doc = await fetchMainDocument(String(req.body?.url || ''));
      mainUrl = doc.finalUrl;
      html = doc.html;
      fetchResource = createFetcher();
      target = doc.finalUrl;
    }
    const scan = await withScanSlot(() => scanDocument({ mainUrl, html, fetchResource }));
    const session = createSession({ isSample, target, mainUrl, html, fetchResource, scan, before: scan.report });
    res.json(publicSession(session));
  } catch (e) {
    sendError(res, e);
  }
});

// 2) Ask Claude to propose fixes for the REAL findings. Nothing is applied here.
app.post('/api/scan/:id/propose', limiter(10, 5), async (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'This scan has expired. Please scan again.' });
  try {
    const result = await proposeFixes(s.scan);
    s.proposal = result;
    res.json({ fixes: result.fixes, needsHuman: result.needsHuman, rejectedCount: result.rejected.length, notSentCount: result.notSentCount, usage: result.usage });
  } catch (e) {
    sendError(res, e);
  }
});

const publicTask = (t) =>
  t && { text: t.text, taskFound: t.taskFound, explanation: t.explanation, before: t.before, after: t.after || null, usage: t.usage };

// Customer Task Check: AI picks the task's elements; keyboard, screen-reader and contrast checks are measured.
app.post('/api/scan/:id/task', limiter(10, 10), async (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'This scan has expired. Please scan again.' });
  const parsed = TaskInputSchema.safeParse(req.body?.task);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid task.' });
  try {
    const doc = { mainUrl: s.mainUrl, html: s.html, fetchResource: s.fetchResource };
    const r = await withScanSlot(() => withDocumentPage(doc, (page) => checkTaskOnPage(page, parsed.data, s.before)));
    s.task = { text: r.task, taskFound: r.taskFound, explanation: r.explanation, goalIds: r.goalIds, signature: r.signature, before: r.result, usage: r.usage };
    s.taskFixes = r.result?.taskFixes || [];
    if (r.taskFound && s.fixedHtml) {
      s.task.after = await withScanSlot(() =>
        withDocumentPage({ ...doc, html: s.fixedHtml }, (page) => recheckTaskOnPage(page, r.goalIds, r.signature, s.after)),
      );
    }
    res.json({ task: publicTask(s.task), taskFixes: s.taskFixes });
  } catch (e) {
    sendError(res, e);
  }
});

// Plain-language owner summary (English / Hindi) of the REAL results so far.
app.post('/api/scan/:id/summary', limiter(10, 10), async (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'This scan has expired. Please scan again.' });
  const lang = LangSchema.safeParse(req.body?.lang);
  if (!lang.success) return res.status(400).json({ error: 'Unsupported language.' });
  try {
    const summary = await writeOwnerSummary(s, lang.data);
    s.summaries = { ...(s.summaries || {}), [lang.data]: summary };
    res.json({ summary });
  } catch (e) {
    sendError(res, e);
  }
});

// 3) Owner-approved fixes are applied to a COPY of the page, which is then re-scanned.
app.post('/api/scan/:id/apply', limiter(10, 10), async (req, res) => {
  const s = getSession(req.params.id);
  const pool = [...(s?.proposal?.fixes || []), ...(s?.taskFixes || [])];
  if (!s || !pool.length) return res.status(404).json({ error: 'Please generate fix proposals first.' });
  const ids = Array.isArray(req.body?.fixIds) ? new Set(req.body.fixIds.map(String)) : new Set();
  const approved = pool.filter((f) => ids.has(f.id));
  if (!approved.length) return res.status(400).json({ error: 'Please select at least one fix to apply.' });
  try {
    const { fixedHtml, outcomes } = await withScanSlot(() => applyFixesToHtml({ mainUrl: s.mainUrl, html: s.html, fixes: approved }));
    const rescan = await withScanSlot(() => scanDocument({ mainUrl: s.mainUrl, html: fixedHtml, fetchResource: s.fetchResource }));
    s.fixedHtml = fixedHtml;
    s.after = rescan.report;
    s.appliedFixes = approved.filter((f) => outcomes.find((o) => o.id === f.id)?.applied);
    s.needsHuman = s.proposal?.needsHuman || [];
    s.comparison = compareReports(s.before, s.after);
    if (s.task?.taskFound) {
      s.task.after = await withScanSlot(() =>
        withDocumentPage({ mainUrl: s.mainUrl, html: fixedHtml, fetchResource: s.fetchResource }, (page) =>
          recheckTaskOnPage(page, s.task.goalIds, s.task.signature, s.after),
        ),
      ).catch(() => null);
    }
    res.json({ after: s.after, comparison: s.comparison, outcomes, task: publicTask(s.task) });
  } catch (e) {
    sendError(res, e);
  }
});

function requireFixed(req, res) {
  const s = getSession(req.params.id);
  if (!s?.fixedHtml) {
    res.status(404).type('text/plain').send('Not available. Apply fixes first.');
    return null;
  }
  return s;
}

// Sandboxed preview of the fixed copy: no scripts, opaque origin.
app.get('/api/scan/:id/preview', (req, res) => {
  const s = requireFixed(req, res);
  if (!s) return;
  const base = s.isSample ? '/samples/bakery/' : s.mainUrl;
  const safeBase = base.replace(/"/g, '%22');
  const html = s.fixedHtml.replace(/<head[^>]*>/i, (m) => `${m}<base href="${safeBase}">`);
  res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src * data:; frame-ancestors 'self'");
  res.type('html').send(html);
});

app.get('/api/scan/:id/fixed.html', (req, res) => {
  const s = requireFixed(req, res);
  if (!s) return;
  res.set('Content-Security-Policy', 'sandbox');
  res.attachment('openramp-fixed-page.html').type('html').send(s.fixedHtml);
});

app.get('/api/scan/:id/report.html', (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).type('text/plain').send('This scan has expired.');
  res.attachment('openramp-accessibility-report.html').type('html').send(renderReportHtml(s));
});

app.post('/api/contact', limiter(60, 5), async (req, res) => {
  const result = await sendContactMessage(req.body || {});
  if (result.ok) return res.json({ ok: true });
  res.status(result.status).json({ error: result.error });
});

app.use(
  '/samples/bakery',
  (_req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // lets the sandboxed (opaque-origin) preview load sample images
    next();
  },
  express.static(SAMPLE_DIR, { index: 'index.html' }),
);
app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));
app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

const server = app.listen(PORT, () => console.log(`OpenRamp listening on http://localhost:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    server.close();
    await closeBrowser();
    process.exit(0);
  });
}
