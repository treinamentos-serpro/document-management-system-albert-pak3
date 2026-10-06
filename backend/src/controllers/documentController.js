const multer = require('multer');
const documentService = require('../services/documentService');
const ServiceError = require('../services/serviceError');

const parseFile = multer({
  storage: multer.diskStorage(documentService.getStorageOptions()),
  limits: { fileSize: documentService.maxFileSize, files: 1, fields: 5, parts: 6 },
  fileFilter(req, file, callback) {
    try {
      documentService.validateFile(file);
      callback(null, true);
    } catch (error) {
      callback(error);
    }
  },
}).single('file');

function receiveFile(req, res, next) {
  parseFile(req, res, error => {
    if (error && /^(Multipart:|Unexpected end of (form|file)|Malformed part header)/.test(error.message)) {
      return next(new ServiceError(400, 'INVALID_MULTIPART', 'Formulário de upload inválido.'));
    }
    next(error);
  });
}

async function upload(req, res) {
  try {
    res.status(201).json(documentService.create(req.file, req.userId));
  } catch (error) {
    if (req.file) await documentService.discardUpload(req.file);
    throw error;
  }
}

function list(req, res) {
  res.json({ documents: documentService.list(req.userId) });
}

function download(req, res, next) {
  const document = documentService.download(req.params.id, req.userId);
  res.type(document.mimeType);
  res.download(document.path, document.originalName, error => {
    if (error) next(error);
  });
}

module.exports = { receiveFile, upload, list, download };