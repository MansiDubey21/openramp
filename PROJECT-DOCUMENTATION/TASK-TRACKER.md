# Task Tracker

Status labels: Completed and tested · Implemented but not tested · In progress · Pending · Blocked

## Phase 1: Research & planning
| Task | Status |
|---|---|
| Requirements, workspace check, research, recommendation | Completed and tested |
| User approval of OpenRamp (with 10 conditions) | Completed (approved 2026-11-14) |
| Detailed MVP spec (TECHNICAL-NOTES.md) | Completed |

## Phase 2: Local build (rechecked timeline, 2026-11-14)
| Task | Target | Status |
|---|---|---|
| SSRF-safe fetcher | 14 Nov | Completed and tested |
| axe-core scanner + evidence report | 14 Nov | Completed and tested |
| Demo sample site | 14 Nov | Completed and tested |
| Claude fix agent (tools, vision, strict schema, validation) | 14 Nov | Completed and tested |
| Apply-to-copy + re-scan + comparison | 14 Nov | Completed and tested (with hand-written fixes) |
| UI (scan / task / results / fixes / verify / contact) | 14 Nov | Completed and tested (live browser flow) |
| Contact form backend | 14 Nov | Implemented; delivery Pending (mailbox) |
| Dockerfile / compose / Caddy | 14 Nov | Implemented but not tested (Docker not running) |
| Real AI test on 10+ cases | 15 Nov | Completed and tested (14 Nov) |
| Customer Task Check (differentiator) | 15 Nov | Completed and tested (14 Nov) |
| Hindi owner report (stretch) | 18 Nov | Pending |
| Docker build + run locally | 15 Nov | Blocked (virtualization disabled; user chose not to change BIOS). **Replaced by:** native Windows run (Completed and tested) + first container build on the VPS |
| Static Docker checks (compose parses, base image tag exists) | 14 Nov | Completed and tested |
| VPS setup script `deploy/vps-setup.sh` | 14 Nov | Implemented but not tested |
| **Rotate Anthropic API key** (exposed in session output) | ASAP | Completed and tested (user rotated 14 Nov; new key verified by format checks + Models API + live task check, never displayed) |
| Git repo + GitHub push | 15–16 Nov | Pending (needs user approval) |
| UI polish after real AI runs, demo script | 16 Nov | Pending |

## Phase 3: Deployment (depends on organizer/purchases)
| Task | Target | Status |
|---|---|---|
| VPS provisioned, SSH, Docker | 17 Nov | Blocked (organizer confirmation) |
| Domain purchase + DNS A record | 17 Nov | Blocked (needs approval and credit) |
| HTTPS via Caddy | 17 Nov | Pending |
| Titan mailbox + test email + live contact form | 18 Nov | Blocked (needs purchase) |
| Project brief, demo video, README final | 19 Nov | Pending |
| HackerEarth submission | 20 Nov (early) | Pending |

## Timeline recheck and deferrals
Core MVP code is about 1.5 days ahead of plan, which leaves buffer for deployment risk.
**Deferred (not in MVP):** HTML/zip upload · multi-page crawl · scanning JS-rendered content · screenshots · second-language reports · database/history · PDF export · automatic AI retry round · GoDaddy Domains API launch checklist · accounts.
**Stretch, only if time allows by 18 Nov:** an "Ask AI to fix what's left" second round, and a Hindi plain-language summary using Haiku.

## External items
| Item | Status |
|---|---|
| `ANTHROPIC_API_KEY` in local `.env` | Completed and tested (verified without revealing) |
| Start Docker Desktop | Blocked (not needed: development continues on Node.js) |
| Organizer GoDaddy credit confirmation / VPS in cart | Pending (unverified) |
| Exact submission closing time on 20 Nov | Pending (unverified) |
| `gddy` CLI not on PATH in Claude's shell | Blocked (low priority until deploy) |
