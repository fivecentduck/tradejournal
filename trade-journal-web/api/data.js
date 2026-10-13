'use strict';
const { HttpError, redis, requireUser, rateLimit, readBody, route } = require('../lib/core');

const MAX_BYTES = 900000; // stays under Upstash's request size limit

// GET reads the journal; PUT/POST (POST is used by sendBeacon on tab close) saves it.
module.exports = route(['GET', 'PUT', 'POST'], async req => {
  const { key } = await requireUser(req);

  if (req.method === 'GET') {
    const raw = await redis('GET', 'data:' + key);
    return { state: raw ? JSON.parse(raw) : null };
  }

  await rateLimit('rl:data:' + key, 300, 600);
  const { state } = await readBody(req);
  if (!state || typeof state !== 'object' || !Array.isArray(state.trades) || !Array.isArray(state.contracts))
    throw new HttpError(400, 'Invalid data.');
  const json = JSON.stringify(state);
  if (json.length > MAX_BYTES) throw new HttpError(413, 'Your journal is too large to save.');
  await redis('SET', 'data:' + key, json);
  return { ok: true };
});
