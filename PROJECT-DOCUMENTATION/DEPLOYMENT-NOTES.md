# Deployment Notes

Nothing deployed. Nothing purchased.

**Prepared (untested):** `Dockerfile` (Playwright v1.65.1 base, non-root `pwuser`, health check), `docker-compose.yml` (app + Caddy 2, shm 1 GB, memory limit 3 GB), `Caddyfile` (automatic HTTPS, www → apex redirect, HSTS), `.env.example`.
Server command once the VPS is ready: `docker compose up -d --build` with `.env` (including `DOMAIN=`) present on the server only.

## Local Docker status (2026-11-14)
- **Docker Desktop cannot run on this PC** (hardware virtualization disabled in BIOS). The user chose not to change BIOS now. **Development continues without Docker**: the app runs directly on Windows with `npm start` (verified in production mode).
- The container will be built and run for the first time **on the VPS** (Linux, where Docker works normally). Budget about 1 hour on deploy day for first-build issues.
- Checked without the engine:
  - `docker compose config` parsed the compose file successfully.
  - The base image `mcr.microsoft.com/playwright:v1.65.1-noble` exists (registry HTTP 200) and matches the installed Playwright 1.65.1.
  - All npm dependencies are pure JavaScript, so a lockfile made on Windows works on Linux.
- Not testable locally: image build, Chromium inside the container as `pwuser`, Caddyfile syntax, HTTPS issuance.
- **⚠ Lesson (incident 2026-11-14):** `docker compose config` **prints every value from `.env`, including secrets.** Running it locally exposed the Anthropic API key in the Claude Code session output (not in git or any file). **Key rotated by the user on 2026-11-14 and the new key verified.** **Never run `docker compose config` where a real `.env` exists.**

## VPS one-time setup script
`deploy/vps-setup.sh` (Ubuntu/Debian): installs Docker Engine + Compose plugin from Docker's official repository and opens ports 22/80/443 with ufw. *Implemented but not tested.*

## Path: Option B, Docker VPS (from registration)
1. Wait for organizer credit confirmation. Check that the cart shows the 4 vCPU / 8 GB VPS at $0. **User approves checkout.**
2. Generate an SSH key locally and install it on the VPS. Connect.
3. Install/verify Docker on the VPS. `docker compose up -d` (app + Caddy).
4. Buy the domain with the credit (**user approval**). Point the A record to the VPS IP (gddy CLI or the GoDaddy DNS UI).
5. Caddy gets the HTTPS certificate automatically once DNS resolves. Verify `https://` in a browser.
6. Buy Titan Business Email Pro Light, 1-month term (**user approval**). Create `hello@<domain>`. Send a test email from another account.
7. Put SMTP credentials **only** in the server's `.env`. Host `smtp.titan.email`, falling back to `smtpout.secureserver.net` per the guide. Username is the full email address.
8. Submit the contact form on the live site and confirm it arrives in the mailbox.

## Known unknowns
- VPS provisioning status and timing: unverified
- GoDaddy credit amount ($25/$40 appears only in the notes, not in the official guide): unverified
- Submission closing time on 20 Nov: unverified
- `gddy` CLI not found on PATH from Claude's shell
