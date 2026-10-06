const { randomUUID } = require('node:crypto');

const users = new Map();

function findByUsername(username) {
  return [...users.values()].find(user => user.username === username);
}

function findById(id) {
  return users.get(id);
}

function create(username, passwordHash) {
  const user = { id: randomUUID(), username, passwordHash };
  users.set(user.id, user);
  return user;
}

module.exports = { findByUsername, findById, create };