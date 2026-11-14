# Technical Notes: OpenRamp MVP Specification

_Approved direction: 2026-11-14. This spec reflects the user's 10 approval conditions._

## 1. MVP user journey (single page)
1. **Scan.** The owner enters a public URL, or clicks "Try the demo bakery site" (a bundled sample with known issues).
2. **Results (real axe-core data).** Score summary by severity (critical/serious/moderate/minor). For every rule: description, WCAG tags, help link, and each affected element with its CSS selector, HTML snippet and axe's failure summary (the evidence). Items axe marks "needs manual review" are counted separately.
3. **AI proposes fixes.** Claude (Sonnet 5.5) receives *only* the real axe output plus page context, uses tools, and returns structured fixes. Each fix shows the element, the change (before → after), a plain-language explanation and a confidence level. Issues it cannot fix safely are listed as "needs a human".
4. **Owner review.** Every fix has a checkbox. Nothing is applied until the owner clicks "Apply selected fixes to a copy".
5. **Verify.** The server applies the approved fixes to a **copy** of the HTML, re-runs axe-core with identical settings, and shows a before/after comparison per rule.
6. **Export.** Download the fixed HTML and an HTML report. A preview is shown in a sandboxed iframe. The live website is never touched.
7. A disclaimer is visible on the results and in the report: *automated testing finds only some accessibility barriers. This is not a WCAG conformance or legal compliance certification.*
8. Contact form (mandatory hackathon deliverable) sends to the Titan mailbox via SMTP.

## 2. Architecture
```
Browser (vanilla HTML/CSS/JS)
   │  JSON over HTTPS
Express server
   ├─ safeFetch ............ guarded HTTP client (SSRF protection, limits)
   ├─ scanner .............. Playwright Chromium (site scripts blocked by CSP) + axe-core
   │     └─ every browser request is intercepted and served via safeFetch
   ├─ fixAgent ............. Claude tool-use loop → validated fix list
   ├─ applyFixes ........... allow-listed DOM operations in Playwright → fixed HTML
   ├─ sessionStore ......... in-memory, TTL 60 min, max 50 sessions
   └─ contact .............. nodemailer → Titan SMTP
```

## 3. Security design (condition 7)
- **URL validation:** http/https only, no credentials in the URL, ports 80/443 only, max length 2048.
- **SSRF:** DNS is resolved inside the socket `lookup` hook, and *every* resolved IP is checked against blocked ranges (private, loopback, link-local incl. 169.254.169.254, CGNAT, multicast, reserved, IPv6 ULA/link-local, IPv4-mapped IPv6). Because the check happens at connect time, DNS rebinding cannot swap in an internal IP between check and use.
- **Redirects** are followed manually (max 5), and each hop is re-validated.
- **Limits:** 15 s timeout per request, 3 MB HTML, 5 MB per subresource, 25 MB total and 80 requests per scan.
- **The browser never touches the network directly:** Playwright `route('**/*')` serves every request through safeFetch. Scripts, media, websockets, extra navigations and iframes are aborted.
- **Website scripts never run:** the scanned document is served with `Content-Security-Policy: script-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`. *Changed 2026-11-14:* the original plan was `javaScriptEnabled:false`, but axe-core cannot run with it (tested: it hangs). CSP was verified to block inline scripts, `onload` handlers and external scripts while still allowing axe-core injection.
- **Fixed-HTML preview:** iframe `sandbox=""` (no scripts, no same-origin). Downloads are served as attachments.
- **Fix application:** only allow-listed operations (`set_attribute` for alt, aria-label, lang, title, and content on meta-viewport; `set_css` for color/background-color with hex values; `set_document_title`). Values are set via the DOM API (no HTML injection) and length-limited. Selectors must be ones axe actually reported.
- **App hardening:** helmet with strict CSP, JSON body limit, rate limits (scans 10/10 min per IP, AI fixes 5/10 min, contact 5/hour), concurrency cap of 2 scans, honeypot plus validation on the contact form, and no secrets or full user content in logs.

## 4. Claude integration
- Model `claude-sonnet-5-5`, effort `medium`, adaptive thinking (default), `max_tokens` 16000, prompt caching on system and tools. Server-side refusal fallback (`fallbacks: "default"`) is enabled.
- **Tools (all computed in code, so Claude never guesses):**
  - `check_contrast(foreground, background, font_size_px, bold)` → WCAG ratio and AA pass/fail
  - `suggest_accessible_color(foreground, background, min_ratio)` → nearest passing foreground color
  - `view_image(image_id)` → the actual image bytes (vision), for writing alt text
  - `submit_fixes(fixes[], needs_human[])` → final answer (strict schema, then re-validated with zod in code)
- Loop is capped at 8 turns. Token usage and estimated cost are shown per run.
- Without an API key, scanning still works and the AI step returns a clear "not configured" message.

## 4b. Customer Task Check (added 2026-11-14, `src/taskCheck.js`)
**Question answered:** "Can every customer complete the task this business cares about, and does it work after the fixes?"
1. `collectInteractive`: visible interactive elements in document order (max 150), tagged `data-openramp-id`. **Role and accessible name come from Chromium's accessibility tree** via the DevTools protocol (`Accessibility.getPartialAXTree`), the same source screen readers use.
2. `pickGoalElements`: **the only AI step.** `claude-haiku-5-5`, effort low, structured JSON output (`output_config.format` json_schema). Ids are validated against the real list. "Not found" is a valid answer. About $0.0001 per task.
3. `measure` (no AI):
   - **Keyboard:** real `Tab` presses from the top (max 120). Records the focus sequence, whether each task element is reached, and stuck focus.
   - **Focus visibility:** screenshot of the element area unfocused vs keyboard-focused. Identical pixels mean invisible focus. *Rule scanners cannot detect this.*
   - **Screen reader:** unnamed task elements are flagged. Transcript of announcements ("Subscribe, button") along the Tab path, playable with the browser's speechSynthesis.
   - **Low vision:** axe-core colour-contrast nodes inside or containing the task elements.
4. **Code-generated fix** (`add_focus_style`) for invisible focus: a fixed CSS template `selector:focus, selector:focus-visible { outline: 3px solid #1a1a1a !important; outline-offset: 2px }`. The selector is structural and validated (`{ } < ; @ \ ,` rejected). It appears in the same approval list as AI fixes.
5. `recheckTaskOnPage`: after fixes, the same elements (matched by index and tag) are re-measured on the fixed copy. The UI shows before → after per customer group and both transcripts.
API: `POST /api/scan/:id/task {task}`. `/apply` re-runs the task automatically if one was checked.

## 5. Known limitations (stated in the UI)
- Task check: if a page has several candidate elements (e.g. two "News" links), the AI picks one. The explanation shows which elements were tested. Behaviour that depends on the site's own JavaScript isn't tested (scripts are blocked).
- Only one page per scan. Content that the site's own JavaScript would render is not scanned (site scripts are blocked for safety).
- The "zero issues" self-test covers OpenRamp's initial page state. The dynamically rendered result panels were built with accessible patterns (live regions, focus management, labels) but have not been axe-scanned yet.
- Automated rules only. Things like keyboard traps, reading order and meaningful link text need human review.
- Fixes are HTML-level patches to a copy. The owner or a developer must apply them in their site builder or CMS.

## 6. Deferred (not in MVP)
HTML/zip upload · multi-page crawl · JS-rendered scanning · screenshots · second-language reports · persistent DB and history · PDF export · automatic AI retry round · GoDaddy Domains API launch checklist · user accounts.
