# OpenRamp

**Make your website work for every customer, before you launch.**

OpenRamp is an AI accessibility fixer for small-business websites. It scans a page with the real **axe-core** engine, has **Claude** propose code fixes (with exact colour-contrast maths and vision-based image descriptions), lets the owner approve each fix, then applies the approved fixes to a **copy** of the page and re-scans it to prove what improved.

Built for the GoDaddy Inclusive Innovation Hackathon 2026.

> Automated testing finds only some accessibility barriers. OpenRamp's results are not a WCAG conformance certificate or legal compliance advice.

## Why
- 95.9% of the top 1M home pages have detectable WCAG failures (WebAIM Million 2026).
- "Overlay" widgets don't fix the underlying code and have drawn criticism and FTC action.
- Small businesses need plain-language, source-level fixes they can trust.

## What makes it different: the Customer Task Check
The owner types the task customers come for (e.g. *"Order a custom cake"*). Claude (Haiku) identifies which buttons and fields complete it, and **everything else is measured in a real browser**:
- **Keyboard-only customer:** real Tab key presses. Can focus reach each step? Is the focus visible? (Measured by comparing screenshots, which catches `outline: none`, a barrier rule scanners can't detect.)
- **Blind customer:** what a screen reader announces at each step, taken from Chromium's accessibility tree. It can be played aloud before and after the fixes.
- **Low-vision customer:** colour-contrast failures on the task's elements.

After the owner approves fixes, the same task is re-tested on the fixed copy, e.g. *keyboard: blocked → can complete*.

Owners can also get a **plain-language summary in English or Hindi** (Claude Haiku). The facts and numbers come from the measurements, and the AI only explains them.

See [PROJECT-BRIEF.md](PROJECT-BRIEF.md) for the full project brief.

## How it works
1. **Scan:** Playwright (headless Chromium) loads the page and runs axe-core against WCAG 2.0/2.1/2.2 A and AA rules. Every finding includes the element's selector and HTML as evidence.
2. **Propose:** Claude (`claude-sonnet-5-5`) receives only the real findings and uses tools: `check_contrast`, `suggest_accessible_color` (computed in code), `view_image` (vision for alt text), and `submit_fixes` (strict JSON schema). The server re-validates every fix against an allow-list.
3. **Approve:** the owner ticks the fixes to apply. Nothing touches the live site.
4. **Verify:** the fixes are applied to a copy via DOM APIs and the copy is re-scanned with the same engine and rules. The app shows before/after per rule, a sandboxed preview, and downloadable fixed HTML and report.

## Security
- SSRF protection: only http/https on ports 80/443. Every DNS answer is checked at socket-connect time (defeats DNS rebinding), and private, loopback, link-local (incl. cloud metadata), CGNAT and IPv6-local ranges are blocked. Redirects are re-validated. Size, time and request-count limits apply.
- The headless browser never touches the network directly: every request goes through the guarded fetcher. Website scripts are blocked by a `script-src 'none'` CSP.
- Fix proposals are limited to allow-listed operations on elements the scan reported, applied with DOM APIs (no HTML injection).
- Strict CSP, helmet headers, rate limits, a scan concurrency cap, and a honeypot plus validation on the contact form.
- Secrets live only in `.env` (git-ignored). See `.env.example`.

## Run locally
```bash
npm install
npx playwright install chromium
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm start              # http://localhost:3000
npm test               # unit + end-to-end tests (no AI calls)
node scripts/try-ai.js sample   # full AI pipeline on the demo site (uses API credit)
```

## Deploy (Docker VPS)
```bash
# on the server, with .env filled in (including DOMAIN)
docker compose up -d --build
```
Caddy obtains HTTPS certificates automatically once the domain's A record points to the server.

## Limitations
One page per scan. Content rendered by the site's JavaScript is not scanned. Fixes are HTML-level patches to a copy, so the owner or their developer applies them in their site builder or CMS. Automated rules cover only part of WCAG.
