# Project Overview

**Status (2026-11-14, end of session 4):** MVP plus the differentiating **Customer Task Check** are built and tested locally (21/21 automated tests, 10 live AI cases, full live browser flow). Not deployed (Docker, VPS, domain and email pending).

**One-line pitch:** OpenRamp tells a small-business owner whether customers who use a keyboard, a screen reader or have low vision can actually complete their key task (order, book, contact). It *measures* this in a real browser, has AI propose fixes the owner approves, and proves the task works afterwards. It also finds problems rule scanners can't, like invisible keyboard focus.

## Hackathon
GoDaddy Inclusive Innovation Hackathon 2026, Round 2. Individual participant. Build phase 13–20 Nov 2026. Hosting: Option B (Docker VPS).

**Challenge (official):** "Build agentic business solutions leveraging Claude and GoDaddy technologies to help entrepreneurs, creators, and small businesses go from idea to launch."

**Scoring:** Impact 35% · Demo 35% · Tech Usage 15% · Execution 15%

## Official mandatory deliverables (source: kickoff guide, pp. 12, 18)
1. Live app deployed on GoDaddy (Docker VPS)
2. Own domain bought on GoDaddy, with DNS pointing to the app
3. Site loads over HTTPS
4. Titan Business Email (Pro Light, 1-month term) mailbox on the domain, with a test email received
5. Working contact form that delivers to that mailbox, with no passwords in code or repo
6. HackerEarth submission by 20 Nov 2026: live link, GitHub repo, project brief

## Product: **OpenRamp** (approved 2026-11-14)
"A ramp for your website." An AI agent that makes a small business's website usable by people with disabilities **before launch**. It finds the barriers, explains them in plain language, writes real code fixes, and re-tests to prove each fix worked. No overlay widgets.

- **Target user:** a small-business owner or freelancer/creator about to launch (or recently launched) a site built with any tool, who can't afford an accessibility consultant.
- **Who benefits downstream:** customers with disabilities (screen-reader, low-vision, keyboard-only users), plus the owner, through more customers and lower legal risk.
- See RESEARCH-AND-COMPETITORS.md for evidence, and TECHNICAL-NOTES.md for the architecture.
