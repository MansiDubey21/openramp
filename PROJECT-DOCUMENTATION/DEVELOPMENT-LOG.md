# Development Log

## 2026-11-14: Session 1 (research & planning)
- Read the kickoff guide (19 pp.), Round 2 notes (3 pp.) and Claude notes v3 (13 pp. incl. addenda).
- Inspected the workspace: only package.json, the lockfile and node_modules. Deps OK.
- Commands: `node --version` (v26.13.0), `npm ls --depth=0`, `docker --version` (29.9.3), `git --version`, `gddy --version` (**not found**).
- A recursive file search for gddy plus `docker info` hung past 120 s and was stopped. A targeted check found no gddy in the usual install paths or the user PATH.
- Claude Code auth: OAuth account, `billingType: prepaid`. Likely billed against the same Console credit (not confirmed; user to check Console → Usage).
- Web research on 3 candidate ideas (see RESEARCH-AND-COMPETITORS.md).
- Created `.gitignore` and the PROJECT-DOCUMENTATION files.
- No feature code written, pending approval.

## 2026-11-14: Session 2 (MVP build)
- User approved OpenRamp with 10 conditions. Wrote the detailed MVP spec (TECHNICAL-NOTES.md).
- Checked the installed SDK 1.8.0: supports beta `fallbacks`, `output_config.effort`, strict tools.
- `npm install express@5 helmet express-rate-limit zod nodemailer playwright @axe-core/playwright ipaddr.js` → 0 vulnerabilities. `npx playwright install chromium`.
- Built safeFetch, scanner, contrast tools, fix agent, sessions, report, contact, server, UI, demo site.
- **Problem:** the first scan hung. **Diagnosis:** a test script showed axe-core never completes when `javaScriptEnabled:false`. **Fix:** JS enabled, plus a `script-src 'none'` CSP header on the scanned document; verified that inline, handler and external scripts are blocked and axe works.
- **Problem:** inline `style` attributes are blocked by our own strict CSP (colour swatches). **Fix:** set styles via the CSSOM (`el.style.cssText`).
- **Problem:** the sandboxed preview (opaque origin) would be blocked from sample images by helmet's CORP header. **Fix:** CORP cross-origin on `/samples/bakery` only.
- First real scan: sample 21 issues/8 rules. example.com 0. W3C BAD demo 46 issues.
- Tests: `npm test` → 16/16 pass. UI screenshots desktop and mobile checked.
- Wrote Dockerfile, docker-compose (app + Caddy), Caddyfile, .env.example, README. Docker daemon not running, so the image is not built yet.
- AI step not run yet: no API key in `.env`.

## 2026-11-14: Session 3 (live AI integration and validation)
- User added the API key. Verified without revealing it: set, `sk-ant-` prefix, no placeholder or whitespace, `.env` git-ignored. SMTP and DOMAIN are still placeholders (expected).
- Models API (no token cost): `claude-sonnet-5-5` and `claude-haiku-5-5` available to this key.
- `node scripts/try-ai.js sample`: 21 fixes, 0 rejected, 21/21 applied, **re-scan 21 → 0**, about $0.061.
- `node scripts/try-ai.js w3c`: 25 fixes, 3 need a human, **46 → 21**.
- **Bug found:** a 15-elements-per-rule cap silently left 18 images unsent to the AI. **Fix:** cap raised to 40 per rule and 120 total, and anything not sent is now counted and shown in the UI (`notSentCount`). Re-run: 43 fixes, **46 → 3**, and the 3 remaining exactly match the 3 "needs a person" items. About $0.135.
- Full browser flow with the live AI on the bakery demo: owner unticked 1 fix, re-scan 21 → 1 (the unticked one), preview, both downloads OK. OpenRamp UI with all panels rendered: **0 axe violations**. No console errors.
- **Flaky test found:** the e2e server startup wait (10 s) was too short while a background evaluation was loading the machine. Raised to 30 s. `npm test` 16/16.
- Competitor re-validation: AI code-fix suggestions already exist (Siteimprove, BrowserStack, WordPress plugins). The positioning was corrected in RESEARCH-AND-COMPETITORS.md.
- Wrote `scripts/eval-cases.js` (10 real cases, writes `data/eval-*.json`). Run: all 10 completed, 0 rejected fixes, 0 new issue types, total about $0.77 (see TESTING-REPORT).

## 2026-11-14: Session 4 (differentiation: Customer Task Check)
- User asked for genuine originality. Researched screen-reader simulators (Silktide), focus-order testing (Silktide, LambdaTest), automated-coverage limits (Deque 57%), and Indian-language reports (none found).
- Decision: keep OpenRamp, re-centred on **customer tasks**. Built `src/taskCheck.js`. Added `withDocumentPage` to scanner.js and `add_focus_style` to applyFixesToHtml (additive changes). Server: `POST /api/scan/:id/task`, and `/apply` accepts keyboard-test fixes and re-checks the task. UI: task card, verdict cards, transcript + speech playback, task before/after. Report: task section.
- Added an invisible-focus bug to the bakery CSS (`.btn-yellow:focus{outline:none}`).
- **Bug (caught by new test):** the selector filter blocked `>`. Fixed.
- **Bugs (live run on the UW demo):** repeated identical issues and dropdowns described by their option text. Fixed (grouping, no option text).
- **Bug (self-introduced while editing):** `profiles` was referenced before definition. Caught by syntax/test run and fixed.
- Verified the UW invisible-focus finding manually: page CSS `input:focus { outline: none; }`.
- Tests: 21/21. Full live browser flow: task blocked → can complete for all 3 groups, issues 21 → 0, UI axe 0 violations.

## 2026-11-14: Session 5 (no-Docker development path)
- User: Docker Desktop can't run (virtualization disabled in BIOS) and they won't change BIOS now. Continuing on Node.js directly.
- `NODE_ENV=production node src/server.js` on Windows: health OK. Home page 200 with CSP. Real-URL scan (W3C tickets) 42 issues. Task check "Buy a ticket": screen reader FAIL. Report download OK.
- **Incident:** static compose validation (`docker compose config`) printed the real `.env` (API key) into the session output. No file or git exposure. User advised to rotate the key. Documented in DEPLOYMENT-NOTES.
- **Bug found:** placeholder SMTP values counted as "configured" (health showed `contact:true`). Fixed `isContactConfigured`; added a unit test. Now returns an honest 503 "not configured".
- Verified the base image tag `playwright:v1.65.1-noble` exists on MCR (HTTP 200).
- Added `deploy/vps-setup.sh` (untested). Updated `.dockerignore`.
- Tests: **22/22**.
- User rotated the API key. New key verified without displaying it: format OK, Models API accepts it (Sonnet 5.5, Haiku 5.5), live task check on the bakery worked ($0.0001). Incident closed.
- User approved git. `git init -b main`. Pre-commit checks: `.env`, node_modules and data/ not staged, and no `sk-ant-…` pattern in any staged file. Added `.gitattributes` (LF for VPS files) after Windows CRLF warnings. First commit of 49 files.
- **Problem:** the PowerShell here-string was not accepted by `git commit -F -` (nothing committed). **Fixed** by using a temp message file. **Problem:** PS 5.1 `Set-Content -Encoding utf8` added a BOM to the commit message. **Fixed** by amending the unpushed commit with a BOM-free UTF-8 file. Verified LF storage with `git ls-files --eol`.
- Remote `origin` = github.com/MansiDubey21/openramp (public). Before pushing, re-signed both unpushed commits with the user's GitHub no-reply address (repo-local `user.email`; global config unchanged) using `git rebase --root --exec "git commit --amend --no-edit --reset-author"`. Verified: personal email absent from history, file content identical to the originals, `.env` not in any commit, no key patterns. **Not pushed yet** (awaiting user approval).
- User approved the push (see below).

## 2026-11-14: Session 6 (waiting for credit; local development)
- User: no organizer email, cart empty. No purchases. Continue locally.
- Contact form: `npm i -D smtp-server`. `tests/contact.test.js` runs the real server against a local SMTP server: 4/4 pass.
- Built `src/ownerSummary.js` + `POST /api/scan/:id/summary` + UI "Explain in plain words: English / हिन्दी" (results and before/after steps, `lang` attribute, speech playback with hi-IN voice) + report section. `tests/summary.test.js`: 3/3.
- Live checks: Hindi and English summaries read and verified. All numbers match the scan. UI axe 0.
- Wrote `PROJECT-BRIEF.md` (for judges) and `DEMO-SCRIPT.md`.
- `npm test`: **29/29**.
- User reviewed PROJECT-BRIEF.md: changed "our/we" to "my/I" (2 places), added "(team size: 1)", kept the name. Demo script: 3 lines changed to "I/my", or "OpenRamp" where it describes app behaviour. User approved; pushed 3 commits (`d47b71d..45e50ae`). Verified via the GitHub API: 54 files, no `.env`, no-reply author, updated brief wording live.

## 2026-11-14: Session 7 (premium UI redesign)
- User asked for a premium SaaS-style redesign, with no new framework and no functional changes.
- Inspected all element IDs and classes used by `app.js` and the tests, and kept every one.
- `public/index.html` restructured:
  - Navy hero with an "Example result" product preview (decorative, `aria-hidden`, labelled as an example).
  - Scan card and trust strip.
  - Sticky 3-step progress stepper.
  - Panel headers, call-to-action bars, a browser-frame preview.
  - How-it-works with icons and a stat band.
  - Two-column contact section and a new footer.
- `public/styles.css` rewritten:
  - Navy/teal palette with AA contrast, type scale, cards and shadows.
  - Metric cards with severity colours, fix cards that highlight when approved, before/after cards.
  - Floating status toast with a progress bar.
  - Animations disabled under `prefers-reduced-motion`.
  - Responsive at 1080, 900 and 640 px.
- `public/app.js` (additive):
  - `setStatus` keeps base classes (toast) and auto-hides success after 6 s.
  - `setStep()` stepper.
  - Severity classes and dots on metric cards.
  - Call-to-action bars hidden when empty.
- Fixes found during visual review:
  - Global `[hidden]{display:none!important}` (CSS display rules could reveal hidden UI).
  - Mobile globe icon fell outside the input (wrapped in `.input-wrap`).
  - `scroll-padding-top` raised to 140px for header + stepper.
  - Preview centred on tablet.
- Removed an invented promise ("I usually reply within a day") from the contact copy.
- Verified:
  - Full live flow (scan → task → AI fixes 22 → apply → 21→0, all 3 customer groups blocked → can complete). Stepper 1→2→3. Report download.
  - axe 0 violations with all panels shown. No horizontal overflow at 820/390 px. Focus rings visible. No console errors.
  - `npm test` 29/29.

## 2026-11-16: Session 8 (local restart + deployment preparation)
- Restarted locally (`npm start`). 24/24 frontend and API checks passed. The user confirmed all 8 browser tests.
- Deployment prep:
  - compose: added `init: true`, log rotation, `mem_limit 4g`, Caddy `depends_on: service_healthy`, HTTP/3 UDP port.
  - `.env.example` documents all env vars, including the optional model overrides.
  - New `deploy/deploy.sh`.
- Validated:
  - compose (temp folder, example env only).
  - Base image facts from the registry (Node 26, amd64, pwuser).
  - Container rehearsal (`npm ci --omit=dev`, prod run, health + scan).
  - bash syntax.
  - Secret scan of all history and GitHub.
  - `npm test` 29/29.
- Wrote the full runbook in DEPLOYMENT-NOTES.md. Nothing deployed or purchased.

## 2026-11-14 (earlier): push
- User approved the push. `git push -u origin main` succeeded (3 commits). Verified via the GitHub API: repo public, 49 files, `.env` and node_modules absent, all commits authored with the no-reply address.
