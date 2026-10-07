const path = require('node:path');
const documentRepository = require('../repositories/documentRepository');
const ServiceError = require('./serviceError');

const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.txt', 'text/plain'],
]);

function validateFile(file) {
  const isImage = /^image\/[a-z0-9][a-z0-9.+-]*$/i.test(file.mimetype);
  if (!isImage && allowedTypes.get(path.extname(file.originalname).toLowerCase()) !== file.mimetype) {
    throw new ServiceError(415, 'UNSUPPORTED_FILE_TYPE', 'Envie uma imagem ou um arquivo PDF, DOCX, XLSX, PPTX ou TXT com tipo correspondente.');
  }
}

function publicMetadata(document) {
  const { id, originalName, size, uploadedAt, owner } = document;
  return { id, originalName, size, uploadedAt, owner };
}

function create(file, owner) {
  if (!file) {
    throw new ServiceError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }
  const originalName = path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '');
  const document = documentRepository.save({
    id: file.filename,
    originalName,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    mimeType: file.mimetype,
  });
  return publicMetadata(document);
}

function list(owner) {
  return documentRepository.findByOwner(owner).map(publicMetadata);
}

function download(id, owner) {
  const document = documentRepository.findById(id);
  if (!document || document.owner !== owner) {
    throw new ServiceError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  return {
    path: documentRepository.getFilePath(document.id),
    originalName: document.originalName,
    mimeType: document.mimeType,
  };
}

function discardUpload(file) {
  return documentRepository.removeFile(file.filename);
}

module.exports = {
  maxFileSize, validateFile, create, list, download, discardUpload,
  getStorageOptions: documentRepository.getStorageOptions,
};