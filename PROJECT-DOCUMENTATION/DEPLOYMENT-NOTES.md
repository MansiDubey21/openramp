# Deployment Notes: GoDaddy Docker VPS (Option B)

**Status (2026-11-16):** Nothing deployed. Nothing purchased. Waiting for organizer credit confirmation. Deployment files are ready and validated as far as possible without Docker locally.

## 1. What will run on the VPS
```
Internet ──443/80──▶ Caddy (container: automatic HTTPS, www→apex redirect, HSTS)
                        │ reverse_proxy
                        ▼
                     OpenRamp app (container: Node 26 + Chromium, user pwuser, port 3000 internal only)
                        │ outbound HTTPS only
                        ▼
              Claude API · scanned websites (SSRF-guarded) · Titan SMTP
```
| File | Purpose |
|---|---|
| `Dockerfile` | Playwright 1.65.1 base (Node 26, Chromium), `npm ci --omit=dev`, runs as non-root `pwuser`, health check on `/api/health` |
| `docker-compose.yml` | app + Caddy. `init: true` (cleans up Chromium processes), shm 1 GB, memory 4 GB, log rotation 3×10 MB. Caddy starts only after the app is healthy. Port 3000 is **not** published |
| `Caddyfile` | HTTPS for `$DOMAIN`, redirect `www.` → apex, HSTS |
| `.env` (server only) | secrets: never in git (`.gitignore`) or the image (`.dockerignore`), permission 600 |
| `deploy/vps-setup.sh` | one-time: Docker Engine + Compose from Docker's official repository, firewall 22/80/443 |
| `deploy/deploy.sh` | each deploy: checks `.env` **without printing values**, `git pull`, build, start, waits for health, checks DNS and HTTPS |

## 2. Validation done without local Docker (2026-11-16)
| Check | Result |
|---|---|
| `docker compose config --quiet` in a temp folder using **only `.env.example`** (no secrets) | Valid (exit 0) |
| Base image `mcr.microsoft.com/playwright:v1.65.1-noble` | Exists. amd64 available. `NODE_VERSION=26` (same as local). `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`. `pwuser` exists |
| Container rehearsal: copied exactly what the Dockerfile copies, `npm ci --omit=dev`, ran with `NODE_ENV=production`, `TRUST_PROXY=1`, no `.env` | 84 prod packages, 0 vulnerabilities, dev-only `smtp-server` absent. `/api/health` OK. Demo scan 21 issues |
| `bash -n` on both deploy scripts | Syntax OK |
| Secrets: `.env`, `sk-ant-…` keys, real `SMTP_PASS`, private keys in **any** commit / on GitHub | None |
| `npm test` | 29/29 |
| **Not testable locally** | Real image build, Chromium inside the container, Caddyfile parsing, HTTPS issuance. These are first exercised on the VPS (allow about 1 hour) |

## 3. Deployment checklist (each 🔒 step needs the user's explicit approval)

### Phase A: Get the server (after organizer confirmation)
| # | Step | Command / action | Why |
|---|---|---|---|
| A1 | Confirm the credit | Organizer email + cart shows **VPS 4 vCPU / 8 GB at $0** | The guide says don't buy before confirmation |
| A2 🔒 | Check out the VPS | godaddy.com cart → checkout (only if total is $0) | Spends credit |
| A3 | Choose the OS | In the VPS setup wizard pick **Ubuntu 24.04 LTS** (or the newest Ubuntu offered). Note the **public IP** and **username** | Scripts support Ubuntu/Debian |
| A4 | Create an SSH key (on Windows PowerShell) | `ssh-keygen -t ed25519 -C "openramp-vps" -f $env:USERPROFILE\.ssh\openramp_vps` (set a passphrase) | Key login is safer than passwords |
| A5 | Install the public key | Show it: `Get-Content $env:USERPROFILE\.ssh\openramp_vps.pub`. Paste it into the GoDaddy VPS panel's SSH keys, or: `Get-Content $env:USERPROFILE\.ssh\openramp_vps.pub \| ssh USER@VPS_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"` | Only the **.pub** file is ever shared. The private key never leaves the PC |
| A6 | Connect | `ssh -i $env:USERPROFILE\.ssh\openramp_vps USER@VPS_IP` | |

### Phase B: Prepare the server (on the VPS, over SSH)
| # | Step | Command | Why |
|---|---|---|---|
| B1 | Update the OS | `sudo apt-get update && sudo apt-get -y upgrade` | Security patches |
| B2 | Get the code | `git clone https://github.com/MansiDubey21/openramp.git ~/openramp && cd ~/openramp` | Public repo, no secrets inside |
| B3 | Install Docker + firewall | `bash deploy/vps-setup.sh`, then `exit` and reconnect (A6) | Docker group takes effect after re-login |
| B4 | Check Docker | `docker run --rm hello-world` | Confirms the engine works |

### Phase C: Domain
| # | Step | Command / action | Why |
|---|---|---|---|
| C1 | Choose a name | `gddy` domain search (CLI must be on PATH first), or the godaddy.com search | Compare price vs credit |
| C2 🔒 | Buy the domain | godaddy.com checkout with credit | Spends credit |
| C3 | Point DNS at the VPS | GoDaddy DNS (or `gddy` DNS commands): **A `@` → VPS_IP** and **A `www` → VPS_IP**. Remove any default "parked" A record | Caddy can only get a certificate once the domain resolves to the server |
| C4 | Verify DNS | On Windows: `nslookup yourdomain.com` shows VPS_IP | Can take minutes up to a few hours |

### Phase D: Secrets and launch (on the VPS)
| # | Step | Command | Why |
|---|---|---|---|
| D1 | Create `.env` | `cd ~/openramp && cp .env.example .env && nano .env` → set `ANTHROPIC_API_KEY`, `DOMAIN` (leave SMTP until Phase E). Save: Ctrl+O, Enter, Ctrl+X | Secrets exist **only** on the server |
| D2 | Lock it down | `chmod 600 .env` (deploy.sh also does this) | Only your user can read it |
| D3 🔒 | Deploy | `bash deploy/deploy.sh` | Builds the image, starts app + Caddy, waits for health, checks DNS + HTTPS. Placeholders are reported by name only |
| D4 | Verify | Browser: `https://yourdomain.com` shows the padlock. `http://` and `www.` redirect. Run the demo scan once | Requirement: site loads over HTTPS |

### Phase E: Business email + contact form
| # | Step | Command / action | Why |
|---|---|---|---|
| E1 🔒 | Buy Titan | **Titan Business Email, Pro Light, term = 1 month** (official guide) | Spends credit |
| E2 | Create mailbox | `hello@yourdomain.com` (CLI or GoDaddy panel). GoDaddy normally adds Titan's MX/SPF DNS records for a GoDaddy domain: verify they exist | Mail delivery needs MX records |
| E3 | Test inbound mail | Send a test email from another account and confirm it arrives | Official requirement |
| E4 | Configure SMTP | `nano .env`: `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=465`, `SMTP_USER=hello@yourdomain.com` (full address), `SMTP_PASS=…`, `CONTACT_TO=hello@yourdomain.com`. Then `docker compose up -d --force-recreate app` | Env changes need a container recreate |
| E5 | If login is rejected | Change `SMTP_HOST=smtpout.secureserver.net` and recreate again | Tip from the official guide |
| E6 | Test the contact form | Submit the form on the live site → check the mailbox | Official requirement |

### Phase F: Submit
| # | Step | Action |
|---|---|---|
| F1 | Final checks | HTTPS ✓ · contact email received ✓ · demo + real scan work ✓ · `docker compose ps` healthy ✓ |
| F2 | Update the brief | Add the live URL to `PROJECT-BRIEF.md` (and README) |
| F3 🔒 | Push to GitHub | After the user reviews the diff |
| F4 🔒 | HackerEarth submission | Live link + GitHub repo + project brief, before the 20 Nov deadline (confirm the exact time) |

## 4. Day-2 operations (on the VPS)
| Need | Command |
|---|---|
| See status | `docker compose ps` |
| App logs / Caddy logs | `docker compose logs -f app` · `docker compose logs -f caddy` |
| Deploy a new version | `bash deploy/deploy.sh` |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` (certificates are kept in the `caddy_data` volume) |
| **Never** | `docker compose config` (prints secrets) · `cat .env` on a shared screen · committing `.env` |
| Optional hardening (only after key login is confirmed working) | Set `PasswordAuthentication no` in `/etc/ssh/sshd_config`, then `sudo systemctl restart ssh` |

## 5. Local Docker status and incident history
- **Docker Desktop cannot run on this PC** (hardware virtualization disabled; user declined BIOS changes, 2026-11-14). Development and tests run natively (`npm start`, `npm test`).
- **⚠ Incident 2026-11-14:** `docker compose config` printed the real `.env` (API key) into the session output. Not in git or any file. **Key rotated by the user and the new key verified.** Validation now runs only in a temp folder with `.env.example`.

## 6. Known unknowns
- VPS provisioning timing and exact cart price: unverified (checked 14 Nov: no email, cart empty)
- GoDaddy credit amount ($25/$40 appears only in the notes, not in the official guide): unverified
- Submission closing time on 20 Nov: unverified
- `gddy` CLI is not on PATH from Claude's shell (needed only for CLI domain search/DNS; the godaddy.com UI works too)
- Which OS images the hackathon VPS offers: unverified
