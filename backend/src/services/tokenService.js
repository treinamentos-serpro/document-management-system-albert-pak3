const jwt = require('jsonwebtoken');

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Configure JWT_SECRET antes de iniciar o backend.');
  }
  return process.env.JWT_SECRET;
}

function issueToken(userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  const token = jwt.sign({}, getSecret(), { algorithm: 'HS256', subject: userId, expiresIn });
  return { token, expiresIn };
}

function getSubject(token) {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || !Number.isFinite(payload.exp)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

module.exports = { getSecret, issueToken, getSubject };