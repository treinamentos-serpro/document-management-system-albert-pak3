const express = require('express');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const errorController = require('./controllers/errorController');
const tokenService = require('./services/tokenService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use(documentRoutes);
app.use(errorController.handle);

if (require.main === module) {
  tokenService.getSecret();
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
