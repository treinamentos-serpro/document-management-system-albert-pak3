const authService = require('../services/authService');
const ServiceError = require('../services/serviceError');

function readCredentials(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ServiceError(400, 'INVALID_REQUEST', 'Informe usuário e senha em um objeto JSON.');
  }
  return req.body;
}

async function register(req, res) {
  const user = await authService.register(readCredentials(req));
  res.status(201).json({ user });
}

async function login(req, res) {
  res.json(await authService.login(readCredentials(req)));
}

function authenticate(req, res, next) {
  const match = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '');
  if (!match) {
    throw new ServiceError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  }
  req.userId = authService.authenticate(match[1]);
  next();
}

module.exports = { register, login, authenticate };