const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const ServiceError = require('./serviceError');

const deriveKey = promisify(scrypt);

function validateCredentials(username, password) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,64}$/.test(username) ||
      typeof password !== 'string' || password.length < 1 || password.length > 128) {
    throw new ServiceError(400, 'INVALID_CREDENTIALS', 'Informe um usuário válido e uma senha de até 128 caracteres.');
  }
}

async function register({ username, password } = {}) {
  validateCredentials(username, password);
  if (password.length < 8) {
    throw new ServiceError(400, 'INVALID_PASSWORD', 'A senha deve ter pelo menos 8 caracteres.');
  }
  if (userRepository.findByUsername(username)) {
    throw new ServiceError(409, 'USERNAME_TAKEN', 'Nome de usuário já cadastrado.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64);
  if (userRepository.findByUsername(username)) {
    throw new ServiceError(409, 'USERNAME_TAKEN', 'Nome de usuário já cadastrado.');
  }
  const user = userRepository.create(username, `${salt}:${hash.toString('hex')}`);
  return { id: user.id, username: user.username };
}

async function login({ username, password } = {}) {
  validateCredentials(username, password);
  const user = userRepository.findByUsername(username);
  const [salt, storedHash] = user ? user.passwordHash.split(':') : ['invalid-user-salt', '00'.repeat(64)];
  const hash = await deriveKey(password, salt, 64);
  if (!user || !timingSafeEqual(hash, Buffer.from(storedHash, 'hex'))) {
    throw new ServiceError(401, 'INVALID_LOGIN', 'Usuário ou senha inválidos.');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  const token = jwt.sign({}, getSecret(), { algorithm: 'HS256', subject: user.id, expiresIn });
  return { token, tokenType: 'Bearer', expiresIn };
}

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Configure JWT_SECRET antes de iniciar o backend.');
  }
  return process.env.JWT_SECRET;
}

function authenticate(token) {
  const secret = getSecret();
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    throw new ServiceError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  }
  if (typeof payload.sub !== 'string' || !Number.isFinite(payload.exp) || !userRepository.findById(payload.sub)) {
    throw new ServiceError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  }
  return payload.sub;
}

module.exports = { register, login, authenticate, getSecret };