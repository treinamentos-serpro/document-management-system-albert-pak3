const multer = require('multer');
const ServiceError = require('../services/serviceError');

function handle(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Não foi possível concluir a operação.';

  if (error instanceof ServiceError) {
    ({ status, code, message } = error);
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code;
    message = status === 413 ? 'O arquivo excede o limite de 10 MiB.' : 'Formulário de upload inválido.';
  } else if (error.code === 'ENOENT' || error.status === 404) {
    status = 404;
    code = 'DOCUMENT_NOT_FOUND';
    message = 'Documento não encontrado.';
  } else if (error.status === 400 || error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_REQUEST';
    message = 'Entrada inválida.';
  } else if (error.status === 413) {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'O corpo da requisição excede o limite permitido.';
  }

  if (status === 500) console.error('Falha no backend:', error);
  res.status(status).json({ error: { code, message } });
}

module.exports = { handle };