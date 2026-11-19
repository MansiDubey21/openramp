// Guarded HTTP client used for every outbound request the scanner makes.
// Protects against SSRF: blocks non-public IPs at socket-connect time (defeats DNS rebinding),
// re-validates every redirect hop, and enforces size/time limits.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import ipaddr from 'ipaddr.js';

export class SafeFetchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** True if the IP is anything other than a plain public unicast address. */
export function isBlockedIp(ip) {
  let addr;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return true;
  }
  if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) addr = addr.toIPv4Address();
  return addr.range() !== 'unicast';
}

/** Validates a user-supplied URL. Returns a URL object or throws SafeFetchError. */
export function validatePublicUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) {
    throw new SafeFetchError('INVALID_URL', 'Please enter a valid web address.');
  }
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SafeFetchError('INVALID_URL', 'Please enter a full web address, for example https://example.com');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('INVALID_URL', 'Only http and https addresses can be scanned.');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('INVALID_URL', 'Addresses containing login details are not allowed.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new SafeFetchError('BLOCKED_URL', 'Only standard web ports (80 and 443) can be scanned.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new SafeFetchError('BLOCKED_URL', 'That address points to a private or internal network and cannot be scanned.');
  }
  if (!net.isIP(host) && !host.includes('.')) {
    throw new SafeFetchError('BLOCKED_URL', 'Please use a public domain name.');
  }
  return url;
}

// DNS lookup hook: runs at connect time, so the IP we check is the IP we connect to.
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, family: options?.family ?? 0 }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || addresses.some((a) => isBlockedIp(a.address))) {
      return callback(new SafeFetchError('BLOCKED_URL', 'That address resolves to a private or internal network.'));
    }
    if (options?.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

/** Plain-language message for owners; the technical code is kept only at the end for support. */
export function friendlyNetworkError(code) {
  const messages = {
    ENOTFOUND: "We couldn't find that website. Please check the address for typos.",
    EAI_AGAIN: "We couldn't look up that website right now. Please check the address and try again.",
    ECONNREFUSED: "The website refused the connection. It may be down. Please try again later.",
    ECONNRESET: 'The website closed the connection unexpectedly. Please try again.',
    ETIMEDOUT: 'The website took too long to respond.',
    EHOSTUNREACH: "The website's server can't be reached right now.",
    ENETUNREACH: "The website's server can't be reached right now.",
    CERT_HAS_EXPIRED: "The website's security certificate has expired, so it can't be scanned safely.",
    DEPTH_ZERO_SELF_SIGNED_CERT: "The website's security certificate isn't trusted, so it can't be scanned safely.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The website's security certificate isn't trusted, so it can't be scanned safely.",
    ERR_TLS_CERT_ALTNAME_INVALID: "The website's security certificate doesn't match its address, so it can't be scanned safely.",
  };
  return messages[code] || `We couldn't reach the website. Please check the address and try again.${code ? ` (code: ${code})` : ''}`;
}

function requestOnce(url, { timeoutMs, maxBytes, accept }) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          'user-agent': 'OpenRampBot/1.0 (website accessibility check)',
          accept: accept || '*/*',
          'accept-encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location, status });
        }
        const declared = Number(res.headers['content-length'] || 0);
        if (declared && declared > maxBytes * 4) {
          res.destroy();
          return reject(new SafeFetchError('TOO_LARGE', 'The page is too large to scan.'));
        }
        let stream = res;
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        let total = 0;
        stream.on('data', (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            stream.destroy();
            reject(new SafeFetchError('TOO_LARGE', 'The page or one of its files is too large to scan.'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () =>
          resolve({
            status,
            contentType: String(res.headers['content-type'] || ''),
            body: Buffer.concat(chunks),
          }),
        );
        stream.on('error', (e) => reject(new SafeFetchError('FETCH_FAILED', `Could not read the response (${e.code || 'error'}).`)));
      },
    );
    req.on('timeout', () => req.destroy(new SafeFetchError('TIMEOUT', 'The website took too long to respond.')));
    req.on('error', (e) => {
      if (e instanceof SafeFetchError) return reject(e);
      reject(new SafeFetchError('FETCH_FAILED', friendlyNetworkError(e.code)));
    });
    req.end();
  });
}

/**
 * Fetch a public URL safely. Follows up to `maxRedirects` redirects, validating each hop.
 * @returns {Promise<{status:number, contentType:string, body:Buffer, finalUrl:string}>}
 */
export async function safeFetch(input, { timeoutMs = 15000, maxBytes = 5 * 1024 * 1024, accept, maxRedirects = 5 } = {}) {
  let url = validatePublicUrl(String(input));
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(url, { timeoutMs, maxBytes, accept });
    if (!res.redirect) return { ...res, finalUrl: url.href };
    url = validatePublicUrl(new URL(res.redirect, url).href);
  }
  throw new SafeFetchError('TOO_MANY_REDIRECTS', 'The website redirected too many times.');
}
