# Project Inventory

_Actual files as of 2026-11-14 (end of session 2). Status labels: Completed and tested · Implemented but not tested · In progress · Pending · Blocked_

## Application code
| Path | Purpose | Depends on | Status |
|---|---|---|---|
| `src/server.js` | Express app: API routes, security headers, rate limits, static files | all src modules, express, helmet, express-rate-limit, dotenv | Completed and tested (e2e tests) |
| `src/safeFetch.js` | SSRF-guarded HTTP client (connect-time IP checks, redirect re-validation, size/time limits) | ipaddr.js | Completed and tested |
| `src/scanner.js` | Playwright + axe-core scan; request interception; CSP script blocking; apply fixes to a copy | playwright, @axe-core/playwright | Completed and tested (sample site, example.com, W3C demo) |
| `src/contrast.js` | WCAG contrast maths (tool functions for Claude) | none | Completed and tested |
| `src/fixAgent.js` | Claude tool-use agent + server-side fix validation (cap 40/rule, 120 total, skipped elements counted) | @anthropic-ai/sdk, zod | Completed and tested (10 live cases, 0 rejected fixes) |
| `src/taskCheck.js` | **Customer Task Check**: AI picks task elements (Haiku), then measured keyboard/focus, screen-reader and contrast checks, a code-generated focus fix, and a re-check after fixes | @anthropic-ai/sdk, zod, Chromium DevTools protocol | Completed and tested (5 automated + live cases) |
| `src/ownerSummary.js` | Plain-language owner summary in English/Hindi (Haiku). Facts built in code from measured results | @anthropic-ai/sdk, zod | Completed and tested (3 automated + live; numbers verified against the scan) |
| `src/report.js` | Before/after comparison, downloadable HTML report (incl. task section), disclaimer | none | Completed and tested (downloaded and checked in browser flow) |
| `src/sessions.js` | In-memory scan sessions (TTL 60 min, max 30) | none | Completed and tested (via e2e) |
| `src/contact.js` | Contact form → SMTP (Titan). Placeholder settings are treated as "not configured" | nodemailer, zod | Completed and tested end to end against a local SMTP server (auth, delivery, Reply-To, header-injection, honeypot). **Titan delivery Pending** (needs mailbox) |

## Front end
| Path | Purpose | Status |
|---|---|---|
| `public/index.html` | Single-page UI: scan, results, fixes, verify, how-it-works, contact | Completed and tested (axe: 0 issues on initial state; screenshots desktop and mobile) |
| `public/styles.css` | Premium navy/teal theme (redesigned 14 Nov): AA contrast, responsive (1080/900/640 px), reduced-motion support | Completed and tested (screenshots desktop/tablet/mobile, axe 0, no overflow) |
| `public/app.js` | UI logic (textContent only, CSP-safe): scan, task check with speech playback, merged fix list, verify | Completed and tested (full live browser flow; audio playback not verifiable headless) |
| `public/favicon.svg` | Icon | Completed |

## Demo, tests, tooling
| Path | Purpose | Status |
|---|---|---|
| `samples/bakery/` | Demo site with known issues (21 axe issues / 8 rules) + an invisible-focus bug on the "Order a custom cake" button (not detectable by axe) + generated images | Completed and tested |
| `scripts/make-sample-images.js` | Renders sample PNGs with Playwright | Completed and tested |
| `scripts/try-scan.js` | CLI scan of the sample site | Completed and tested |
| `scripts/try-ai.js` | Full AI pipeline + cost report on one page | Completed and tested |
| `scripts/eval-cases.js` | 10-case live evaluation → `data/eval-*.json` | Completed and tested ($0.77 run) |
| `scripts/try-task.js` | Task check before/after on the bakery demo | Completed and tested |
| `tests/task.test.js` | Task check measurements with stubbed AI, id validation, selector injection | Completed and tested (5/5) |
| `tests/contact.test.js` | Real server → nodemailer → local SMTP server (dev dependency `smtp-server`) | Completed and tested (4/4) |
| `tests/summary.test.js` | Owner summary facts, language validation, malformed AI output | Completed and tested (3/3) |
| `PROJECT-BRIEF.md` | Submission project brief for judges | Completed (draft; live URL to add after deployment) |
| `PROJECT-DOCUMENTATION/DEMO-SCRIPT.md` | 3-minute demo walkthrough | Completed (draft) |
| `tests/unit.test.js` | SSRF, URL validation, contrast, fix validation, comparison, contact validation | Completed and tested (7/7) |
| `tests/e2e.test.js` | Real server: scan, SSRF via API, error paths, headers | Completed and tested (6/6) |
| `tests/apply.test.js` | Apply → re-scan, injection safety, OpenRamp self-scan | Completed and tested (3/3) |

## Deployment and config
| Path | Purpose | Status |
|---|---|---|
| `Dockerfile` | Playwright base image (tag verified to exist), non-root user, health check | Implemented but not tested (no Docker on this PC: virtualization disabled; first build will be on the VPS) |
| `docker-compose.yml` | app + Caddy (automatic HTTPS) | Parses with `docker compose config`. Run not tested |
| `deploy/vps-setup.sh` | One-time Docker + firewall setup on the Ubuntu/Debian VPS | Implemented but not tested |
| `Caddyfile` | HTTPS reverse proxy, www redirect, HSTS | Implemented but not tested |
| `.dockerignore`, `.gitignore` | Keep secrets, tests and docs out of image/repo | Completed and tested (`.env`, node_modules, data/ confirmed absent from the commit) |
| `.gitattributes` | Forces LF line endings for VPS files (sh, Dockerfile, Caddyfile, yml) | Completed and tested (`git ls-files --eol` shows LF) |
| `.env.example` | Placeholder config (no secrets) | Completed |
| `README.md` | Repo documentation | Completed |
| `package.json` | ES modules; scripts start/dev/test | Completed and tested |

## Dependencies (npm ls, 2026-11-14; npm audit: 0 vulnerabilities)
Dev only: smtp-server 3.21.4 (contact-form test).
@anthropic-ai/sdk 1.8.0 · @axe-core/playwright 4.14.0 (axe-core 4.14.0) · dotenv 18.0.10 · express 5.3.0 · express-rate-limit 8.7.4 · helmet 8.3.0 · ipaddr.js 2.5.0 · nodemailer 10.5.0 · playwright 1.65.1 (Chromium installed) · zod 4.6.7

## Environment
Node v26.13.0 · npm 11.20.0 · git 2.56.0 · Docker CLI 29.9.3 (**engine cannot run: hardware virtualization disabled**; app runs natively with `npm start`) · `gddy` not on PATH from Claude's shell · git repository on branch `main`, pushed to **https://github.com/MansiDubey21/openramp** (public) on 2026-11-14
