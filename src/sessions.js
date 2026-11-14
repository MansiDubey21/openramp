// In-memory scan sessions (MVP: no database). Bounded in count and lifetime.
import crypto from 'node:crypto';

const TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 30;
const sessions = new Map();

export function createSession(data) {
  prune();
  while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  const id = crypto.randomUUID();
  sessions.set(id, { id, createdAt: Date.now(), ...data });
  return sessions.get(id);
}

export function getSession(id) {
  const s = typeof id === 'string' ? sessions.get(id) : undefined;
  if (!s) return null;
  if (Date.now() - s.createdAt > TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return s;
}

function prune() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.createdAt > TTL_MS) sessions.delete(id);
}
