'use strict';
const { HttpError, redis, verifyPassword, requireUser, endSession, rateLimit, readBody, route } = require('../lib/core');

// POST { password } permanently deletes the account, its data, and releases the IP claim.
module.exports = route(['POST'], async (req, res) => {
  const { key, user } = await requireUser(req);
  await rateLimit('rl:del:' + key, 5, 900);
  const { password } = await readBody(req);
  if (typeof password !== 'string' || !(await verifyPassword(password, user.hash))) throw new HttpError(401, 'Wrong password.');

  await redis('DEL', 'user:' + key);
  await redis('DEL', 'data:' + key);
  if (user.ip && (await redis('GET', 'ip:' + user.ip)) === key) await redis('DEL', 'ip:' + user.ip);
  endSession(req, res);
  return { ok: true };
});
