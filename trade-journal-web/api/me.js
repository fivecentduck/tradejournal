'use strict';
const { isAdmin, requireUser, route } = require('../lib/core');

module.exports = route(['GET'], async req => {
  const { key, user } = await requireUser(req);
  return { username: user.username, admin: isAdmin(key) };
});
