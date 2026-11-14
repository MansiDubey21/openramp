# Decisions

| Date | Decision | Reason | Status |
|---|---|---|---|
| 2026-11-14 | Treat the official kickoff guide as the source of truth. Notes PDFs are supporting only | User instruction | Final |
| 2026-11-14 | Recommend Candidate A (accessibility fixer, "OpenRamp") over a vernacular builder or an inbox agent | Highest combined impact, originality and demo strength. B duplicates GoDaddy Airo and existing products (see RESEARCH) | **Awaiting user approval** |
| 2026-11-14 | Proposed stack: Node + Express + vanilla front end + Playwright/axe-core + Claude SDK + node:sqlite + Caddy | Simple, Docker-friendly, reuses installed deps | **Awaiting user approval** |
| 2026-11-14 | Haiku 5.5 for simple steps, Sonnet 5.5 default, Opus only if needed | User's cost-control rule | Final |
| 2026-11-14 | Added `.gitignore` excluding `.env` before any secrets exist | Security rule | Done |
| 2026-11-14 | OpenRamp approved with 10 conditions (real engine, evidence, no live changes, re-scan, disclaimer, SSRF, simple UI, timeline, docs) | User approval | Final |
| 2026-11-14 | Block site scripts with CSP instead of disabling JS | axe-core cannot run with JS disabled (tested). CSP verified to block page scripts | Final |
| 2026-11-14 | All browser traffic goes through safeFetch via request interception | Closes SSRF via subresources and DNS rebinding | Final |
| 2026-11-14 | Fixes limited to allow-listed DOM operations on reported selectors only | Claude proposes, code enforces. No HTML injection possible | Final |
| 2026-11-14 | In-memory sessions (no DB) for MVP | Simpler. Nothing sensitive persisted. Accepted trade-off: scans lost on restart | Final |
| 2026-11-14 | Sonnet 5.5 (effort medium) for fixes, server-side refusal fallback `"default"` enabled | User's model rule. Fallback avoids a dead end if a request is declined | Final |
| 2026-11-14 | AI input cap: 40 elements per rule, 120 total, with skipped elements counted and shown | The original 15 cap silently skipped issues (found in testing). Honesty requires visibility | Final |
| 2026-11-14 | Pitch as "verified, owner-approved fixes for any site", not "first AI fixer" | Research found existing AI code-suggestion tools (Siteimprove, BrowserStack, WP plugins) | Final |
| 2026-11-14 | Keep OpenRamp but re-centre on **customer tasks** (Customer Task Check) rather than changing idea | Research: scan + AI suggestions isn't unique. No tool found that does task-based, measured, before/after-verified checks for owners | Final |
| 2026-11-14 | AI only picks task elements. All verdicts are measured (Tab presses, screenshots, accessibility tree, axe) | Avoids AI-invented results. Matches the user's condition 2 | Final |
| 2026-11-14 | Haiku 5.5 for task-element picking | Simple classification step. About $0.0001 per task | Final |
| 2026-11-14 | Invisible-focus fix is code-generated from a fixed CSS template, still owner-approved | Mechanical fix needs no AI. Fixed template keeps it injection-safe | Final |
| 2026-11-14 | Added an invisible-focus bug to the bakery demo | Demonstrates a barrier rule scanners miss. Mirrors a real pattern (confirmed on the UW demo) | Final |
| 2026-11-14 | Hindi owner report: deferred (stretch) | Task check prioritised. Time reserved for deployment | Superseded (built the same day while waiting for credit) |
| 2026-11-14 | Owner summary: English + Hindi only, facts built in code, Haiku writes the words | Only languages whose output could be checked. Numbers can't be invented | Final |
| 2026-11-14 | Test contact delivery against a local `smtp-server` (dev dep), not an external test-mail service | No data sent to third parties. Real SMTP auth path exercised | Final |
| 2026-11-14 | Develop and test natively on Windows. The first Docker build happens on the VPS | Virtualization disabled. User declined BIOS changes. Docker files kept ready and statically checked | Final |
| 2026-11-14 | Never run `docker compose config` with a real `.env` | It printed the API key in session output (incident). Key rotation requested | Final |
| 2026-11-14 | W3C "BAD" demo page as second live-demo target | Public site designed to be inaccessible, so it's safe and legitimate to scan in a demo | Final |
