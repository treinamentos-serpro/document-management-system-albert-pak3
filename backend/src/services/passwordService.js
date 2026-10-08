const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
const keyLength = 64;
const dummyPasswordHash = `invalid-user-salt:${'00'.repeat(keyLength)}`;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, keyLength);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = (passwordHash || dummyPasswordHash).split(':');
  const expectedHash = Buffer.from(storedHash, 'hex');
  const actualHash = await deriveKey(password, salt, keyLength);
  return expectedHash.length === actualHash.length && timingSafeEqual(actualHash, expectedHash);
}

module.exports = { hashPassword, verifyPassword };