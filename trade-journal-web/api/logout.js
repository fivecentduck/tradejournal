'use strict';
const { endSession, route } = require('../lib/core');

module.exports = route(['POST'], async (req, res) => {
  endSession(req, res);
  return { ok: true };
});
