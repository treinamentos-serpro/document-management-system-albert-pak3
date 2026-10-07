const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');
const { unlink, readdir } = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'segredo-exclusivo-dos-testes-de-integracao';
const app = require('../src/app');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

let server;
let baseUrl;
const createdFiles = new Set();
const storageDirectory = path.resolve(__dirname, '../storage');

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const filename of createdFiles) {
    await unlink(path.join(storageDirectory, filename)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
});

function sendJson(route, body) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function createUser(username) {
  const credentials = { username, password: 'senha-segura-123' };
  const registration = await sendJson('/auth/register', credentials);
  assert.strictEqual(registration.status, 201);
  const { user } = await registration.json();
  assert.deepStrictEqual(Object.keys(user).sort(), ['id', 'username']);
  const login = await sendJson('/auth/login', credentials);
  assert.strictEqual(login.status, 200);
  const { token, tokenType } = await login.json();
  assert.strictEqual(tokenType, 'Bearer');
  return { user, token };
}

function upload(token, content = 'Documento de teste', filename = 'documento.txt', type = 'text/plain', field = 'file') {
  const form = new FormData();
  form.append(field, new Blob([content], { type }), filename);
  form.append('owner', 'outro-usuario');
  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

test('autenticação e documentos locais seguem os contratos da API', async context => {
  const first = await createUser('primeiro');
  const second = await createUser('segundo');
  const headers = { Authorization: `Bearer ${first.token}` };
  let document;

  await context.test('cadastro e login rejeitam entradas inválidas', async () => {
    assert.strictEqual((await sendJson('/auth/register', { username: 'primeiro', password: 'senha-segura-123' })).status, 409);
    assert.strictEqual((await sendJson('/auth/register', {})).status, 400);
    assert.strictEqual((await sendJson('/auth/register', null)).status, 400);
    assert.strictEqual((await sendJson('/auth/login', [])).status, 400);
    const wrongPassword = await sendJson('/auth/login', { username: 'primeiro', password: 'errada' });
    const unknownUser = await sendJson('/auth/login', { username: 'inexistente', password: 'errada' });
    assert.strictEqual(wrongPassword.status, 401);
    assert.deepStrictEqual(await wrongPassword.json(), await unknownUser.json());
  });

  await context.test('rotas exigem token válido e não expirado', async () => {
    for (const route of ['/upload', '/documents', '/documents/inexistente/download']) {
      const response = await fetch(`${baseUrl}${route}`, { method: route === '/upload' ? 'POST' : 'GET' });
      assert.strictEqual(response.status, 401);
    }
    for (const token of ['invalido', jwt.sign({}, process.env.JWT_SECRET, { subject: first.user.id, expiresIn: -1 })]) {
      assert.strictEqual((await fetch(`${baseUrl}/documents`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    }
  });

  await context.test('upload salva arquivo local e metadados seguros', async () => {
    const response = await upload(first.token);
    assert.strictEqual(response.status, 201);
    document = await response.json();
    createdFiles.add(document.id);
    assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.strictEqual(document.owner, first.user.id);
    assert.strictEqual(document.originalName, 'documento.txt');
    assert.strictEqual(document.size, Buffer.byteLength('Documento de teste'));
    assert.ok(!Number.isNaN(Date.parse(document.uploadedAt)));
    assert.ok((await readdir(storageDirectory)).includes(document.id));
  });

  await context.test('listagem isola proprietários e ordena uploads recentes primeiro', async () => {
    const response = await upload(first.token, 'Mais recente', 'recente.txt');
    assert.strictEqual(response.status, 201);
    const recent = await response.json();
    createdFiles.add(recent.id);
    const listing = await fetch(`${baseUrl}/documents`, { headers });
    assert.deepStrictEqual((await listing.json()).documents.map(item => item.id), [recent.id, document.id]);
    const otherListing = await fetch(`${baseUrl}/documents`, { headers: { Authorization: `Bearer ${second.token}` } });
    assert.deepStrictEqual(await otherListing.json(), { documents: [] });
  });

  await context.test('download preserva bytes e nome e impede acesso cruzado', async () => {
    const route = `/documents/${document.id}/download`;
    const response = await fetch(`${baseUrl}${route}`, { headers });
    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment.*documento.txt/);
    assert.match(response.headers.get('content-type'), /text\/plain/);
    assert.strictEqual(await response.text(), 'Documento de teste');
    assert.strictEqual((await fetch(`${baseUrl}${route}`, { headers: { Authorization: `Bearer ${second.token}` } })).status, 404);
    assert.strictEqual((await fetch(`${baseUrl}/documents/inexistente/download`, { headers })).status, 404);
    await unlink(path.join(storageDirectory, document.id));
    assert.strictEqual((await fetch(`${baseUrl}${route}`, { headers })).status, 404);
  });

  await context.test('imagens de diferentes formatos podem ser enviadas e baixadas', async () => {
    const formats = [
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['gif', 'image/gif'],
      ['webp', 'image/webp'],
      ['svg', 'image/svg+xml'],
      ['bmp', 'image/bmp'],
      ['tiff', 'image/tiff'],
      ['avif', 'image/avif'],
      ['heic', 'image/heic'],
      ['ico', 'image/vnd.microsoft.icon'],
    ];
    for (const [extension, type] of formats) {
      const content = Buffer.from([0, 1, 2, 127, 255]);
      const filename = `imagem.${extension}`;
      const response = await upload(first.token, content, filename, type);
      assert.strictEqual(response.status, 201, filename);
      const image = await response.json();
      createdFiles.add(image.id);
      assert.strictEqual(image.originalName, filename);
      const download = await fetch(`${baseUrl}/documents/${image.id}/download`, { headers });
      assert.strictEqual(download.status, 200);
      assert.ok(download.headers.get('content-type').startsWith(type));
      assert.match(download.headers.get('content-disposition'), /attachment/);
      assert.deepStrictEqual(Buffer.from(await download.arrayBuffer()), content);
      const otherDownload = await fetch(`${baseUrl}/documents/${image.id}/download`, {
        headers: { Authorization: `Bearer ${second.token}` },
      });
      assert.strictEqual(otherDownload.status, 404);
    }
  });

  await context.test('uploads inválidos não deixam arquivos no disco', async () => {
    const initialFiles = (await readdir(storageDirectory)).sort();
    assert.strictEqual((await upload(first.token, 'executavel', 'arquivo.exe', 'application/octet-stream')).status, 415);
    assert.strictEqual((await upload(first.token, 'texto', 'arquivo.pdf', 'text/plain')).status, 415);
    assert.strictEqual((await upload(first.token, 'texto', 'imagem.png', 'text/plain')).status, 415);
    assert.strictEqual((await upload(first.token, Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.png', 'image/png')).status, 413);
    assert.strictEqual((await upload(first.token, 'texto', 'arquivo.txt', 'text/plain', 'campoErrado')).status, 400);
    assert.strictEqual((await fetch(`${baseUrl}/upload`, { method: 'POST', headers })).status, 400);
    const malformed = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      body: 'formulario sem boundary',
    });
    assert.strictEqual(malformed.status, 400);
    assert.deepStrictEqual(await malformed.json(), {
      error: { code: 'INVALID_MULTIPART', message: 'Formulário de upload inválido.' },
    });
    assert.strictEqual((await upload(first.token, Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
    assert.deepStrictEqual((await readdir(storageDirectory)).sort(), initialFiles);
  });
});
