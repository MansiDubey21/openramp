# OpenRamp: Project Brief
**GoDaddy Inclusive Innovation Hackathon 2026 · Individual entry · Mansi Dubey**

> **Can every customer complete the one thing your business needs them to do?**
> OpenRamp tests a small-business website the way customers with disabilities use it, has AI propose fixes the owner approves, and proves the result by re-testing.

- **Live app:** _to be added after deployment (GoDaddy VPS + own domain, HTTPS)_
- **Code:** https://github.com/MansiDubey21/openramp

---

## 1. The problem
- **95.9%** of the top one million home pages have detectable WCAG accessibility failures, averaging 56.1 errors per page (WebAIM Million, 2026).
- When a small business's "Order" button is unlabeled or its keyboard focus is invisible, customers who are blind, have low vision or can't use a mouse **cannot buy**. The owner never finds out.
- Owners have poor options. Free scanners produce technical rule lists. Overlay widgets don't fix the code and have drawn criticism (including a US FTC order against one vendor in 2025). Enterprise platforms are priced for large organisations.
- Rule scanners can't see everything. Even Deque's own data says automated rules cover about 57% of issues, and problems like invisible keyboard focus are left to manual testing.

**Who benefits:** small-business owners and creators launching or running a website on any builder, and their customers who use screen readers, keyboards or need high contrast.

## 2. What OpenRamp does
1. **Scan:** enter a public URL. The open-source **axe-core** engine checks WCAG 2.0/2.1/2.2 A/AA rules in a sandboxed browser. Every finding shows the exact element as evidence.
2. **Customer Task Check (our core idea):** the owner types the task customers come for, e.g. *"Order a custom cake"*. OpenRamp then **measures** three customer experiences:
   - **Keyboard-only:** real Tab-key presses. Is each step reachable? Is focus visible? (Measured by comparing screenshots, which catches `outline: none`, a barrier rule scanners can't detect.)
   - **Blind (screen reader):** what is announced at each step, from the browser's accessibility tree. It can be played aloud: *"button"* before, *"Subscribe, button"* after.
   - **Low vision:** contrast failures on the task's elements.
3. **AI fix proposals:** Claude proposes minimal code fixes, each with a plain-language reason. Anything it can't fix safely is listed as "needs a person".
4. **Owner approval:** nothing is applied without a tick, and the live site is never changed.
5. **Proof:** approved fixes are applied to a **copy**, re-scanned, and the task re-tested, e.g. *keyboard: blocked → can complete*.
6. **Plain-language summary in English or Hindi** for owners, with numbers taken from the measurements. Downloadable fixed HTML and report.

## 3. What is different (stated carefully)
AI code-fix suggestions already exist in enterprise tools (e.g. Siteimprove, BrowserStack) and WordPress plugins, and free screen-reader simulators exist for manual exploration. In our research **we did not find a tool that**:
- starts from the owner's **business task in plain words**,
- **measures** whether keyboard, screen-reader and low-vision customers can complete it,
- and **re-verifies that same task after owner-approved fixes**, with a before/after audio transcript,
- for **any website**, with no install, and with explanations in **Hindi** as well as English.

It also complements GoDaddy's journey: Airo can build a site, and OpenRamp is the pre-launch check that everyone can use it.

## 4. How Claude is used (beyond a basic integration)
| Step | Model | How |
|---|---|---|
| Fix proposals | **Claude Sonnet 5.5** | Tool-use agent with tools computed in code: `check_contrast`, `suggest_accessible_color` (exact WCAG maths), `view_image` (**vision** for alt text), `submit_fixes` (strict JSON schema). The server re-validates every fix against an allow-list |
| Task elements | **Claude Haiku 5.5** | Structured JSON output: maps the owner's words to the page's real elements. Ids are validated, and "not found" is allowed |
| Owner summary | **Claude Haiku 5.5** | Plain English/Hindi from facts assembled in code, so numbers are never invented |

Cost control: the cheapest suitable model per step, prompt caching, effort settings, and cost shown per run (about **$0.06** for the bakery demo's fixes, about **$0.0001** per task check).

## 5. How GoDaddy technology is used
- **Hosting:** Docker container on a **GoDaddy VPS**, with Caddy for automatic HTTPS. _(Deployment pending organizer credit confirmation.)_
- **Domain:** bought on GoDaddy, DNS pointed at the VPS. _(Pending.)_
- **Titan Business Email:** the site's contact form sends to the domain mailbox over authenticated SMTP. _(Code tested end to end against a local SMTP server; Titan delivery pending.)_

## 6. Results so far (measured, 14 Nov 2026)
- **10 real pages** (W3C and University of Washington accessibility demos, Wikipedia, GOV.UK, example.com, bundled demo):
  - **0** AI fixes rejected by the safety validator, and **0** new issue types introduced.
  - Total AI cost **$0.77**.
  - Examples: bakery demo **21 → 0** issues. W3C demo pages **46 → 3**, **47 → 5**, **42 → 3**, **44 → 3**.
  - Every remaining issue was explicitly flagged "needs a person". The "fixed" W3C control page and GOV.UK/example.com got no unnecessary changes.
- **Task check, real page:** found invisible keyboard focus on 5 checkboxes of a university demo form (confirmed: the page CSS sets `input:focus { outline: none }`). axe-core reported nothing for it.
- **Bakery demo task "Order a custom cake":** all 3 customer groups **blocked → can complete** after approved fixes.
- OpenRamp's own interface: **0** axe-core violations.

## 7. Engineering and security
- **SSRF protection:** every DNS answer is checked at connect time (defeats DNS rebinding). Private, loopback, cloud-metadata and IPv6-local ranges are blocked. Redirects are re-validated. Size, time and request limits apply.
- **Scanned sites' scripts never run:** a `script-src 'none'` CSP, and all browser traffic goes through the guarded fetcher.
- **AI output is constrained:** allow-listed fix operations, applied through DOM APIs (no HTML injection), on elements the scan actually reported.
- Strict CSP and security headers, rate limits, contact-form honeypot and header-injection protection. Secrets only in environment variables (never in git).
- **29 automated tests** (unit, end-to-end, security, task check, contact delivery, summary validation) plus a 10-case live AI evaluation.

## 8. Honest limitations
- Automated testing finds only some barriers. **OpenRamp is not a WCAG certificate or legal advice**, and the app says so everywhere.
- One page per scan. Content rendered by the site's own JavaScript isn't tested.
- Fixes are limited to safe attribute, colour and focus changes. Layout issues (e.g. tap-target size) go to a person.
- Fixes are delivered as a corrected copy and report. The owner or their developer applies them in their site builder.

## 9. What's next
Multi-page and scheduled re-checks · applying fixes directly in popular site builders · more Indian languages · task checks for forms that need site scripts (in an isolated sandbox).
