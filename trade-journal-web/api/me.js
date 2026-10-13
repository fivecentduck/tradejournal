'use strict';
const { requireUser, route } = require('../lib/core');

module.exports = route(['GET'], async req => {
  const { user } = await requireUser(req);
  return { username: user.username };
});
