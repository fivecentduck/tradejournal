'use strict';
const crypto = require('crypto');
const { isAdmin, HttpError, redis, hashPassword, ipHash, startSession, rateLimit, readBody, route } = require('../lib/core');

module.exports = route(['POST'], async (req, res) => {
  const ip = ipHash(req);
  await rateLimit('rl:reg:' + ip, 8, 3600);

  const { username, password, adminCode } = await readBody(req);
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,24}$/.test(username))
    throw new HttpError(400, 'Username must be 3 to 24 characters: letters, numbers, dot, dash or underscore.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200)
    throw new HttpError(400, 'Password must be at least 8 characters.');

  const key = username.toLowerCase();

  // "admin" is reserved: it can only be created with the server's ADMIN_SETUP_CODE, so a stranger can't claim it first.
  if (key === 'admin') {
    const code = process.env.ADMIN_SETUP_CODE;
    if (!code || code.length < 8) throw new HttpError(403, 'The username "admin" is reserved. Set ADMIN_SETUP_CODE (8+ characters) on the server to create it.');
    await rateLimit('rl:admincode', 20, 3600);
    const a = crypto.createHash('sha256').update(String(adminCode || '')).digest();
    const b = crypto.createHash('sha256').update(code).digest();
    if (!crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Wrong admin setup code.');
  }

  const hash = await hashPassword(password);
  const limitIp = !process.env.DISABLE_IP_LIMIT && key !== 'admin';

  // Atomic claims (SET NX) so two simultaneous sign-ups can't both succeed.
  if (limitIp) {
    const ok = await redis('SET', 'ip:' + ip, key, 'NX');
    if (ok !== 'OK') throw new HttpError(409, 'An account has already been created from this network. Sign in to that account instead.');
  }
  const created = await redis('SET', 'user:' + key, JSON.stringify({ username, hash, ip, created: Date.now() }), 'NX');
  if (created !== 'OK') {
    if (limitIp) await redis('DEL', 'ip:' + ip);
    throw new HttpError(409, 'That username is taken.');
  }
  startSession(req, res, key);
  return { username, admin: isAdmin(key) };
});
