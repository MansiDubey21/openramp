// Real accessibility scanning with axe-core inside headless Chromium.
// Safety model: page JavaScript is disabled, and the browser never touches the network itself.
// Every request is intercepted and served through a fetcher we control (safeFetch or local sample files).
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { safeFetch, SafeFetchError } from './safeFetch.js';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const SAMPLE_ORIGIN = 'https://demo.openramp.local';

const LIMITS = { maxRequests: 80, maxTotalBytes: 25 * 1024 * 1024, maxHtmlBytes: 3 * 1024 * 1024 };
// Applied to every scanned document: no website script may run inside our browser.
const PAGE_CSP = "script-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const VISION_TYPES =new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    const args = process.env.CHROMIUM_NO_SANDBOX === 'true' ? ['--no-sandbox'] : [];
    browserPromise = chromium.launch({ args }).catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close();
  }
}

/**
 * Creates a resource fetcher with a per-scan budget and a cache (so re-scans reuse identical resources).
 * If sampleDir is given, URLs on SAMPLE_ORIGIN are served from that local folder instead of the network.
 */
export function createFetcher({ sampleDir = null } = {}) {
  const cache = new Map();
  let requests = 0;
  let totalBytes = 0;
  return async function fetchResource(url) {
    if (cache.has(url)) return cache.get(url);
    let result;
    if (sampleDir && url.startsWith(SAMPLE_ORIGIN + '/')) {
      const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
      const file = path.resolve(sampleDir, rel || 'index.html');
      if (!file.startsWith(path.resolve(sampleDir) + path.sep)) return null; // path traversal guard
      try {
        const body = await fs.readFile(file);
        result = { status: 200, contentType: contentTypeFor(file), body };
      } catch {
        result = { status: 404, contentType: 'text/plain', body: Buffer.from('not found') };
      }
    } else {
      if (++requests > LIMITS.maxRequests) return null;
      try {
        result = await safeFetch(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 15000 });
      } catch {
        return null;
      }
      totalBytes += result.body.length;
      if (totalBytes > LIMITS.maxTotalBytes) return null;
    }
    cache.set(url, result);
    return result;
  };
}

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' }[ext] ||
    'application/octet-stream'
  );
}

/** Downloads the main HTML document of a public URL (SSRF-guarded). */
export async function fetchMainDocument(url) {
  const res = await safeFetch(url, { maxBytes: LIMITS.maxHtmlBytes, accept: 'text/html,application/xhtml+xml' });
  if (res.status >= 400) throw new SafeFetchError('HTTP_ERROR', `The website responded with error ${res.status}.`);
  if (!/html/i.test(res.contentType)) throw new SafeFetchError('NOT_HTML', 'That address is not a web page (HTML).');
  return { html: res.body.toString('utf8'), finalUrl: res.finalUrl };
}

/** Opens a page whose main document is `html` at `mainUrl`, with all sub-requests served by fetchResource. */
async function openPage({ mainUrl, html, fetchResource, loadResources = true }) {
  const browser = await getBrowser();
  // JS stays enabled only so our own axe-core engine can be injected (via DevTools protocol, which CSP doesn't affect).
  // The website's own scripts are blocked by the CSP header below (inline, external, event handlers, javascript: URLs).
  const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const images = new Map(); // url -> { mediaType, base64 }
  let mainServed = false;
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    try {
      if (req.isNavigationRequest()) {
        if (!mainServed && url === mainUrl && req.frame() === page.mainFrame()) {
          mainServed = true;
          return route.fulfill({
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': PAGE_CSP },
            body: html,
          });
        }
        return route.abort('blockedbyclient'); // no extra navigations (meta refresh) or iframes
      }
      const type = req.resourceType();
      if (!loadResources || ['script', 'media', 'websocket', 'eventsource', 'manifest', 'texttrack', 'other'].includes(type)) {
        return route.abort('blockedbyclient');
      }
      const res = await fetchResource(url);
      if (!res) return route.abort('blockedbyclient');
      const mediaType = res.contentType.split(';')[0].trim().toLowerCase();
      if (type === 'image' && VISION_TYPES.has(mediaType) && res.body.length <= 4 * 1024 * 1024) {
        images.set(url, { mediaType, base64: res.body.toString('base64') });
      }
      return route.fulfill({ status: res.status, contentType: res.contentType || undefined, body: res.body });
    } catch {
      return route.abort('failed').catch(() => {});
    }
  });
  await page.goto(mainUrl, { waitUntil: 'load', timeout: 45000 });
  return { context, page, images };
}

function summarizeAxe(axe) {
  const violations = axe.violations.map((v) => ({
    id: v.id,
    impact: v.impact || 'minor',
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    wcag: v.tags.filter((t) => /^wcag\d/.test(t)),
    nodes: v.nodes.map((n) => {
      const contrast = n.any?.find((c) => c.id === 'color-contrast')?.data;
      return {
        selector: n.target.map(String).join(' >>> '),
        simpleSelector: n.target.length === 1 && typeof n.target[0] === 'string' ? n.target[0] : null,
        html: (n.html || '').slice(0, 600),
        failureSummary: n.failureSummary || '',
        impact: n.impact || v.impact || 'minor',
        contrast: contrast
          ? { fgColor: contrast.fgColor, bgColor: contrast.bgColor, ratio: contrast.contrastRatio, expected: contrast.expectedContrastRatio, fontSize: contrast.fontSize, fontWeight: contrast.fontWeight }
          : null,
      };
    }),
  }));
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let issueCount = 0;
  for (const v of violations) {
    for (const n of v.nodes) {
      byImpact[n.impact] = (byImpact[n.impact] || 0) + 1;
      issueCount++;
    }
  }
  return {
    violations,
    issueCount,
    ruleCount: violations.length,
    byImpact,
    needsReviewCount: axe.incomplete.reduce((s, i) => s + i.nodes.length, 0),
    passedRuleCount: axe.passes.length,
    engine: `axe-core ${axe.testEngine?.version || ''}`.trim(),
    tags: AXE_TAGS,
  };
}

/** Runs axe-core against the document. Returns a structured report plus page context for the AI step. */
export async function scanDocument({ mainUrl, html, fetchResource }) {
  const { context, page, images } = await openPage({ mainUrl, html, fetchResource });
  try {
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const report = summarizeAxe(axe);
    const pageInfo = await page.evaluate(() => ({
      title: document.title || '',
      lang: document.documentElement.getAttribute('lang') || '',
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 2000),
    }));
    // Map <img> elements flagged for missing alt text to the actual image bytes we downloaded.
    const imageCandidates = [];
    for (const v of report.violations.filter((x) => ['image-alt', 'input-image-alt'].includes(x.id))) {
      for (const n of v.nodes) {
        if (!n.simpleSelector) continue;
        const src = await page.$eval(n.simpleSelector, (el) => el.currentSrc || el.src || '').catch(() => '');
        if (src && images.has(src)) imageCandidates.push({ selector: n.simpleSelector, src, ...images.get(src) });
      }
    }
    return { report, pageInfo, imageCandidates };
  } finally {
    await context.close();
  }
}

/**
 * Opens the document in the same sandboxed setup used for scanning (site scripts blocked, guarded network)
 * and runs fn(page). The page is always closed afterwards. Used by the customer task check.
 */
export async function withDocumentPage({ mainUrl, html, fetchResource }, fn) {
  const { context, page } = await openPage({ mainUrl, html, fetchResource });
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

// Operations Claude may propose. Anything else is rejected.
export const ALLOWED_ATTRIBUTES = new Set(['alt', 'aria-label', 'lang', 'title', 'content']);
export const ALLOWED_CSS = new Set(['color', 'background-color']);

/**
 * Applies approved fixes to a COPY of the HTML using DOM APIs (no HTML string injection).
 * Returns the fixed HTML and a per-fix outcome.
 */
export async function applyFixesToHtml({ mainUrl, html, fixes }) {
  const { context, page } = await openPage({ mainUrl, html, fetchResource: async () => null, loadResources: false });
  try {
    const outcomes = await page.evaluate((list) => {
      return list.map((f) => {
        try {
          if (f.action === 'set_document_title') {
            let t = document.querySelector('head > title');
            if (!t) {
              t = document.createElement('title');
              document.head.prepend(t);
            }
            t.textContent = f.value;
            return { id: f.id, applied: true };
          }
          if (f.action === 'add_focus_style') {
            // Fixed, safe CSS template; only the (validated) selector varies.
            // Block characters that could end the rule, start another rule/at-rule, or close the <style> tag.
            // (">" is the CSS child combinator and cannot escape a <style> element, so it is allowed.)
            if (typeof f.selector !== 'string' || f.selector.length > 500 || /[{}<;@\\,]/.test(f.selector)) {
              return { id: f.id, applied: false, reason: 'Invalid selector' };
            }
            if (!document.querySelector(f.selector)) return { id: f.id, applied: false, reason: 'Element not found' };
            const st = document.createElement('style');
            st.setAttribute('data-openramp', 'focus-fix');
            st.textContent = `${f.selector}:focus, ${f.selector}:focus-visible { outline: 3px solid #1a1a1a !important; outline-offset: 2px !important; }`;
            document.head.append(st);
            return { id: f.id, applied: true };
          }
          const el = document.querySelector(f.selector);
          if (!el) return { id: f.id, applied: false, reason: 'Element not found' };
          if (f.action === 'set_attribute') {
            if (f.name === 'content' && !(el.tagName === 'META' && (el.getAttribute('name') || '').toLowerCase() === 'viewport')) {
              return { id: f.id, applied: false, reason: 'content attribute only allowed on meta viewport' };
            }
            el.setAttribute(f.name, f.value);
            return { id: f.id, applied: true };
          }
          if (f.action === 'set_css') {
            el.style.setProperty(f.name, f.value, 'important');
            return { id: f.id, applied: true };
          }
          return { id: f.id, applied: false, reason: 'Unsupported action' };
        } catch (e) {
          return { id: f.id, applied: false, reason: String(e.message || e) };
        }
      });
    }, fixes);
    const fixedHtml = await page.content();
    return { fixedHtml, outcomes };
  } finally {
    await context.close();
  }
}
