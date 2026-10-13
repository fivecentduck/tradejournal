'use strict';
const { HttpError, redis, hashPassword, ipHash, startSession, rateLimit, readBody, route } = require('../lib/core');

module.exports = route(['POST'], async (req, res) => {
  const ip = ipHash(req);
  await rateLimit('rl:reg:' + ip, 8, 3600);

  const { username, password } = await readBody(req);
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,24}$/.test(username))
    throw new HttpError(400, 'Username must be 3 to 24 characters: letters, numbers, dot, dash or underscore.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200)
    throw new HttpError(400, 'Password must be at least 8 characters.');

  const key = username.toLowerCase();
  const hash = await hashPassword(password);
  const limitIp = !process.env.DISABLE_IP_LIMIT;

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
  return { username };
});
