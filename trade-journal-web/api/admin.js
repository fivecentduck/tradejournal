'use strict';
const { isAdmin, HttpError, redis, requireUser, rateLimit, route } = require('../lib/core');

const MAX_USERS = 1000;

// Quick per-user summary, computed on the server so the list doesn't have to download every journal.
function summarize(state) {
  const trades = Array.isArray(state && state.trades) ? state.trades : [];
  let net = 0, closed = 0, open = 0, wins = 0;
  trades.forEach(t => {
    if (t.exitPrice == null) { open++; return; }
    const dir = t.side === 'short' ? -1 : 1;
    const n = (t.exitPrice - t.entryPrice) * dir * t.qty * t.pv - t.fee * t.qty * 2;
    if (Number.isFinite(n)) { net += n; closed++; if (n > 0) wins++; }
  });
  return { trades: trades.length, closed, open, wins, net: Math.round(net * 100) / 100, startingBalance: Number(state && state.startingBalance) || 0 };
}

// Admin only (the account named "admin"). GET /api/admin lists accounts; GET /api/admin?user=name returns one journal.
// Passwords hashes and IP data are never returned.
module.exports = route(['GET'], async req => {
  const { key } = await requireUser(req);
  if (!isAdmin(key)) throw new HttpError(403, 'Forbidden.');
  await rateLimit('rl:admin', 120, 600);

  const target = new URL(req.url || '/', 'http://x').searchParams.get('user');
  if (target) {
    const t = target.toLowerCase();
    if (!/^[a-z0-9_.-]{3,24}$/.test(t)) throw new HttpError(400, 'Invalid user.');
    const rawUser = await redis('GET', 'user:' + t);
    if (!rawUser) throw new HttpError(404, 'No such account.');
    const u = JSON.parse(rawUser);
    const raw = await redis('GET', 'data:' + t);
    return { username: u.username, created: u.created, state: raw ? JSON.parse(raw) : null };
  }

  const keys = new Set();
  let cursor = '0';
  do {
    const res = await redis('SCAN', cursor, 'MATCH', 'user:*', 'COUNT', 200);
    cursor = String(res[0]);
    (res[1] || []).forEach(k => keys.add(k));
  } while (cursor !== '0' && keys.size < MAX_USERS);

  const names = Array.from(keys).slice(0, MAX_USERS).map(k => k.slice(5));
  const users = [];
  for (let i = 0; i < names.length; i += 25) {
    const chunk = names.slice(i, i + 25);
    const [profiles, datas] = await Promise.all([
      redis('MGET', ...chunk.map(n => 'user:' + n)),
      redis('MGET', ...chunk.map(n => 'data:' + n))
    ]);
    chunk.forEach((n, j) => {
      if (!profiles[j]) return;
      const p = JSON.parse(profiles[j]);
      let st = null; try { st = datas[j] ? JSON.parse(datas[j]) : null; } catch (e) { /* ignore bad data */ }
      users.push({ username: p.username, created: p.created, ...summarize(st) });
    });
  }
  users.sort((a, b) => (a.created || 0) - (b.created || 0));
  return { users };
});
