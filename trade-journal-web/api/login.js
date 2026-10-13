'use strict';
const { HttpError, redis, verifyPassword, DUMMY, ipHash, startSession, rateLimit, readBody, route } = require('../lib/core');

module.exports = route(['POST'], async (req, res) => {
  const { username, password } = await readBody(req);
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 40 || password.length > 200)
    throw new HttpError(400, 'Enter a username and password.');
  const key = username.trim().toLowerCase();

  await rateLimit('rl:login:ip:' + ipHash(req), 30, 900);
  await rateLimit('rl:login:u:' + key, 10, 900);

  const raw = await redis('GET', 'user:' + key);
  const user = raw ? JSON.parse(raw) : null;
  const ok = await verifyPassword(password, user ? user.hash : DUMMY); // constant-ish time either way
  if (!user || !ok) throw new HttpError(401, 'Wrong username or password.');

  startSession(req, res, key);
  return { username: user.username };
});
