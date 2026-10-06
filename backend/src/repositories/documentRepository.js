const { randomUUID } = require('node:crypto');
const { mkdir } = require('node:fs');
const { unlink } = require('node:fs/promises');
const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const documents = new Map();

function getStorageOptions() {
  return {
    destination(request, file, callback) {
      mkdir(storageDirectory, { recursive: true }, error => callback(error, storageDirectory));
    },
    filename(request, file, callback) {
      callback(null, randomUUID());
    },
  };
}

function save(document) {
  documents.set(document.id, document);
  return document;
}

function findByOwner(owner) {
  return [...documents.values()].filter(document => document.owner === owner).reverse();
}

function findById(id) {
  return documents.get(id);
}

async function removeFile(filename) {
  try {
    await unlink(path.join(storageDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function getFilePath(filename) {
  return path.join(storageDirectory, filename);
}

module.exports = { getStorageOptions, save, findByOwner, findById, removeFile, getFilePath };