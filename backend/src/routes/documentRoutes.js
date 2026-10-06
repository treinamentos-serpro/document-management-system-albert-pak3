const express = require('express');
const authController = require('../controllers/authController');
const documentController = require('../controllers/documentController');

const router = express.Router();
router.use(authController.authenticate);
router.post('/upload', documentController.receiveFile, documentController.upload);
router.get('/documents', documentController.list);
router.get('/documents/:id/download', documentController.download);

module.exports = router;