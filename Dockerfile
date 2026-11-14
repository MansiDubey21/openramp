# OpenRamp production image. The Playwright base image ships Node.js and a matching Chromium build.
# Keep this tag in sync with the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY samples ./samples

# Run as the image's unprivileged user, never root.
USER pwuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
