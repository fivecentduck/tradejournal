'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const SESSION_DAYS = 30;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ---------- Redis (Upstash REST, no dependencies) ---------- */
async function redis(...cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new HttpError(500, 'Database is not configured.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd.map(x => (typeof x === 'number' ? x : String(x))))
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { console.error('redis error', j.error); throw new HttpError(500, 'Database error.'); }
  return j.result;
}

/* ---------- Secrets & hashing ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new HttpError(500, 'Server is not configured (missing SESSION_SECRET).');
  return s;
}
const hmac = (label, data) => crypto.createHmac('sha256', secret()).update(label + ':' + data).digest('hex');

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
const DUMMY = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`;
async function verifyPassword(pw, stored) {
  try {
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(pw, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) { return false; }
}

/* ---------- Client IP ---------- */
function expandV6(ip) {
  if (ip.includes('::')) {
    const [h, t] = ip.split('::');
    const head = h ? h.split(':') : [], tail = t ? t.split(':') : [];
    return [...head, ...Array(Math.max(8 - head.length - tail.length, 0)).fill('0'), ...tail];
  }
  return ip.split(':');
}
function normalizeIp(raw) {
  let ip = String(raw || '').trim().toLowerCase();
  if (ip.startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  if (ip.includes(':')) return 'v6:' + expandV6(ip).slice(0, 4).map(g => g.padStart(4, '0')).join(':'); // group IPv6 by /64
  return 'v4:' + ip;
}
function clientIp(req) {
  const h = req.headers;
  const raw = h['x-vercel-forwarded-for'] || h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || '';
  return normalizeIp(raw);
}
const ipHash = req => hmac('ip', clientIp(req));

/* ---------- Sessions ---------- */
const b64 = s => Buffer.from(s).toString('base64url');
function signToken(payload) { const body = b64(JSON.stringify(payload)); return body + '.' + hmac('sess', body); }
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const good = hmac('sess', body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function cookieString(req, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? '; Secure' : '';
  return `tj_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
function startSession(req, res, userKey) {
  const token = signToken({ u: userKey, exp: Date.now() + SESSION_DAYS * 86400000 });
  res.setHeader('Set-Cookie', cookieString(req, token, SESSION_DAYS * 86400));
}
function endSession(req, res) { res.setHeader('Set-Cookie', cookieString(req, '', 0)); }

async function requireUser(req) {
  const p = verifyToken(parseCookies(req).tj_session);
  if (!p) throw new HttpError(401, 'Not signed in.');
  const raw = await redis('GET', 'user:' + p.u);
  if (!raw) throw new HttpError(401, 'Not signed in.');
  return { key: p.u, user: JSON.parse(raw) };
}

/* ---------- Misc ---------- */
async function rateLimit(key, max, windowSec) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, windowSec);
  if (n > max) throw new HttpError(429, 'Too many attempts. Please wait a while and try again.');
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { throw new HttpError(400, 'Invalid request.'); } }
  return {};
}
function checkOrigin(req) {
  const o = req.headers.origin;
  if (!o) return;
  let host; try { host = new URL(o).host; } catch (e) { throw new HttpError(403, 'Bad origin.'); }
  if (host !== req.headers.host) throw new HttpError(403, 'Bad origin.');
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function route(methods, fn) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return send(res, 405, { error: 'Method not allowed.' }); }
      if (req.method !== 'GET') checkOrigin(req);
      const out = await fn(req, res);
      if (out !== undefined && !res.writableEnded) send(res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Something went wrong.' });
    }
  };
}

module.exports = { HttpError, redis, hashPassword, verifyPassword, DUMMY, ipHash, startSession, endSession, requireUser, rateLimit, readBody, route };
