# Testing Report

## Automated suite: `npm test` (2026-11-14). Result: **16/16 pass**
| # | Test | Result |
|---|---|---|
| 1 | Demo scan returns real axe-core findings with evidence (≥15 issues; image-alt, color-contrast, html-has-lang, document-title, button-name, link-name present; selector/html/failureSummary present; disclaimer present) | Pass |
| 2 | SSRF via API: 127.0.0.1, 169.254.169.254 metadata, localhost:3999, [::1], file://, 10.0.0.5 all return 400 | Pass |
| 3 | AI step without API key returns 503 "not configured" (no fake fixes) | Pass |
| 4 | Apply before proposing / unknown scan returns 404 | Pass |
| 5 | Contact: invalid email 400; SMTP not configured 503 (honest); honeypot 200 silently | Pass |
| 6 | Security headers: CSP `script-src 'self'`, nosniff, no x-powered-by | Pass |
| 7 | `isBlockedIp`: private, loopback, link-local, CGNAT, multicast, broadcast, IPv6 ULA/link-local, IPv4-mapped all blocked; public allowed | Pass |
| 8 | `validatePublicUrl`: file/ftp, decimal/hex IP encodings, credentials, non-standard ports, single-label hosts rejected | Pass |
| 9 | `safeFetch('http://localhost/')` blocked at DNS/connect stage | Pass |
| 10 | Contrast maths: 21:1 black/white; #777 fails (4.48), #767676 passes (4.54); large-text threshold 3:1; suggested colour passes | Pass |
| 11 | Fix validator: rejects unreported selectors, `onerror`/`src` attributes, CSS injection, non-allow-listed CSS properties, bad lang codes, unknown actions | Pass |
| 12 | Before/after comparison maths | Pass |
| 13 | Contact schema validation | Pass |
| 14 | Hand-written fixes applied to a copy: 6/7 applied, missing element reported, re-scan shows exactly 6 fewer issues and no new issue types | Pass |
| 15 | Injection attempt in a fix value is escaped (no `<script>` in output) | Pass |
| 16 | OpenRamp's own home page: 0 axe violations (initial state) | Pass |

## Manual / exploratory checks (2026-11-14)
| Check | Result |
|---|---|
| Real site `http://example.com` → 0 issues, about 1.0 s | Pass |
| W3C "BAD" inaccessible demo page → 46 issues (image-alt 33, link-name 7, color-contrast 2, target-size 2, html-has-lang, select-name), 32 images captured, about 3.1 s | Pass |
| Website scripts blocked: inline `<script>`, `onload`, external script all prevented by CSP while axe runs | Pass |
| UI screenshots desktop 1280px and mobile 390px: layout OK | Pass |
| UI "Propose fixes" without key shows a clear error | Pass |

## Live AI evaluation: 10 real cases (`node scripts/eval-cases.js`, 2026-11-14, claude-sonnet-5-5)
All AI proposals were applied to a copy, then re-scanned with the same engine and rules. Raw data: `data/eval-2026-11-14T14-17-12-174Z.json` (git-ignored).
| # | Page | Before | After | Fixes (applied / rejected) | Needs a person | Not sent to AI | New issue types | Cost |
|---|---|---|---|---|---|---|---|---|
| 1 | Bakery demo | 21 | **0** | 21 (21/0) | 2 (confirm dropdown label guess; WhatsApp link has no number) | 0 | none | $0.058 |
| 2 | W3C BAD home | 46 | **3** | 43 (43/0) | 3 | 0 | none | $0.133 |
| 3 | W3C BAD news | 47 | **5** | 42 (42/0) | 5 (drop-cap images, tap-target size) | 0 | none | $0.150 |
| 4 | W3C BAD tickets | 42 | **3** | 39 (39/0) | 3 | 0 | none | $0.116 |
| 5 | W3C BAD survey | 44 | **3** | 41 (41/0) | 3 (unclear field "ev", target size) | 0 | none | $0.112 |
| 6 | W3C BAD home **after** (control) | 2 | 2 | 0 | 2 (target size only) | 0 | none | $0.006 |
| 7 | example.com (control) | 0 | n/a | AI not called | n/a | n/a | n/a | $0 |
| 8 | UW AccessComputing demo | 25 | **7** | 18 (18/0) | 7 (ambiguous field "sp", small checkboxes) | 0 | none | $0.072 |
| 9 | Wikipedia article | 130 | 84 | 46 (46/0) | 11 | **73** (over the 120-element cap; shown to the user) | none | $0.125 |
| 10 | GOV.UK home (control) | 0 | n/a | AI not called | n/a | n/a | n/a | $0 |
**Total estimated AI cost: $0.77.** Every remaining issue in cases 1–8 is one Claude explicitly listed as "needs a person". It did not fabricate fixes for ambiguous cases, and the control pages got no unnecessary changes.
**Observed limitation:** `target-size` (tap-target size) is the most common unfixable issue, because it needs layout CSS that the safe fix list doesn't allow. Large pages (Wikipedia) exceed the per-pass cap.

## Live AI browser flow (2026-11-14)
Bakery demo in Chromium: 21 fixes displayed with plain-language explanations and cost ($0.057). Owner **unticked 1 fix**: re-scan 21 → 1, and the remaining issue is exactly the unticked one. Preview iframe rendered. Report download (disclaimer and before/after table present) and fixed-HTML download (`lang="en"` present) both worked. axe on OpenRamp's UI with all panels rendered: **0 violations**. Console errors: none.

## Customer Task Check (session 4, 2026-11-14)
**Automated (`tests/task.test.js`, stubbed AI, deterministic): 5/5 pass.** Full suite **21/21 pass**.
| Test | Result |
|---|---|
| `announce()` phrasing ("Subscribe, button") | Pass |
| Bakery "Order a custom cake": keyboard FAIL (invisible focus), screen reader FAIL (unnamed button and select), low vision FAIL (contrast). After focus, name and colour fixes, **all 3 PASS** | Pass |
| Task not on page reported as not found (no verdicts invented) | Pass |
| AI-returned ids outside the element list are discarded | Pass |
| Malicious selector `a} body{display:none` rejected by the focus-style fix | Pass |

**Live (real Claude + real pages):**
| Page / task | Result |
|---|---|
| Bakery / "Subscribe to offers by email" | SR FAIL ("button") → after fix PASS ("Subscribe, button"). About $0.0001 |
| Bakery / "Follow the bakery on Instagram" | SR FAIL ("link") → PASS ("Sunrise Bakery on Instagram, link") |
| Bakery / "Book a table for dinner" | Correctly **not found** |
| W3C BAD survey / "Submit the survey" | SR FAIL: unnamed radio buttons and combo box |
| UW AccessComputing / "Submit the registration form" | Keyboard FAIL: invisible focus on 5 checkboxes (**confirmed manually**: page CSS `input:focus{outline:none}`; axe reports nothing). SR FAIL: 3 unnamed text fields, 5 unnamed checkboxes |
| W3C BAD home / "Go to the news page" | PASS, but Claude chose the demo wrapper's accessible "News" link rather than the broken in-page one. **Known limitation:** ambiguity between candidate elements |
| Full browser flow, bakery: scan → task → AI proposals (21) + keyboard-test fix (1) → apply all | Issues 21 → 0. Task: keyboard, screen reader and low vision all **blocked → can complete**. Before/after transcripts with Play buttons. Report includes the task section. UI axe 0 violations. No console errors. Mobile layout checked |
| Bug found by tests | The focus-fix selector filter wrongly blocked `>` (the CSS child combinator). Fixed: only `{ } < ; @ \ ,` are blocked |
| Bug found in live run | Repeated identical findings and long option text in labels. Fixed by grouping "(5 elements)" and not describing dropdowns by their options |

## Native Windows run, no Docker (session 5, 2026-11-14)
| Check | Result |
|---|---|
| `NODE_ENV=production node src/server.js`: `/api/health` | Pass (`ai:true`, `contact:false` after fix) |
| Home page 200, CSP header present | Pass |
| Real URL scan (W3C BAD tickets) through the API | Pass (42 issues) |
| Task check "Buy a ticket" via API | Pass (screen-reader barrier found) |
| Report download (attachment) | Pass |
| Contact form with placeholder SMTP returns honest 503 | Pass (**bug fixed**: was treated as configured) |
| `npm test` | **22/22 pass** |
| Docker: compose file parses; base image tag exists on MCR | Pass (static only) |
| Docker image build/run | **Not tested**: no virtualization on this PC; will be tested on the VPS |

## Contact form and owner summary (session 6, 2026-11-14). `npm test`: **29/29 pass**
| Test | Result |
|---|---|
| Contact: health reports configured with real (non-placeholder) settings | Pass |
| Contact: valid message delivered via **authenticated SMTP** to the mailbox. Subject, Reply-To and body correct | Pass |
| Contact: header injection (`\r\nBcc:` in name) neutralised. Only the business mailbox receives it | Pass |
| Contact: honeypot submission not sent | Pass |
| Summary: facts built from real results (incl. task and re-scan). Unsupported language rejected. Malformed AI output rejected | Pass |
| **Live** Hindi summary (bakery, before fixes): natural Hindi, explains "screen reader". Numbers used [21, 7, 13, 5, 1] all match the scan | Pass |
| **Live** Hindi summary (after fixes): numbers [21, 7, 13, 2] match (21 resolved, 2 needs-a-person) | Pass |
| **Live** English summary: numbers [21, 7, 13, 1, 9] match | Pass |
| UI with summaries shown: axe 0 violations. `lang="hi"` set on Hindi text. No page errors | Pass |
| Note: the first live run's "English" check read the Hindi text because *the test* didn't wait for the new content. Re-run with a correct wait: Pass | Test-script issue, not an app bug |

## UI redesign regression check (session 7, 2026-11-14)
| Check | Result |
|---|---|
| `npm test` (incl. OpenRamp self-scan, 0 issues) | 29/29 pass |
| Live flow on the running server: scan → task check → 22 fixes → apply → verify → report download | Pass (21 → 0; task blocked → can complete ×3) |
| Stepper state 1 → 2 → 3, `aria-current="step"` | Pass |
| axe-core with every panel rendered | 0 violations |
| Horizontal overflow at 820 px and 390 px | None |
| Visible keyboard focus on nav button, URL field, Scan, Demo | Pass |
| Bugs found and fixed during review | Mobile input icon misplaced. Sticky header covered headings. `[hidden]` could be overridden by CSS display |

## Not yet tested
| Item | Blocker |
|---|---|
| Speech playback audible on a real device (`speechSynthesis`) | Headless browser cannot verify audio. Button presence and wiring verified |
| Docker image build and run | Docker Desktop not running |
| Contact email delivery to Titan mailbox | Mailbox not purchased yet |
| HTTPS on the real domain | Domain/VPS pending |
| SSRF redirect-to-internal hop (needs a public test server that redirects) | Covered by code path (every hop re-validated), not by a live test |
