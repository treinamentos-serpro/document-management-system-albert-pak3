const userRepository = require('../repositories/userRepository');
const passwordService = require('./passwordService');
const ServiceError = require('./serviceError');
const tokenService = require('./tokenService');

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
  const passwordHash = await passwordService.hashPassword(password);
  if (userRepository.findByUsername(username)) {
    throw new ServiceError(409, 'USERNAME_TAKEN', 'Nome de usuário já cadastrado.');
  }
  const user = userRepository.create(username, passwordHash);
  return { id: user.id, username: user.username };
}

async function login({ username, password } = {}) {
  validateCredentials(username, password);
  const user = userRepository.findByUsername(username);
  const passwordMatches = await passwordService.verifyPassword(password, user?.passwordHash);
  if (!user || !passwordMatches) {
    throw new ServiceError(401, 'INVALID_LOGIN', 'Usuário ou senha inválidos.');
  }
  const { token, expiresIn } = tokenService.issueToken(user.id);
  return { token, tokenType: 'Bearer', expiresIn };
}

function authenticate(token) {
  const userId = tokenService.getSubject(token);
  if (!userId || !userRepository.findById(userId)) {
    throw new ServiceError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  }
  return userId;
}

module.exports = { register, login, authenticate };