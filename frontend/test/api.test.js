import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument, login, logout, registerUser } from '../src/services/api.js';

beforeEach(() => mock.method(console, 'warn', () => {}));

afterEach(() => {
  mock.restoreAll();
  logout();
});

test('lista documentos pelo prefixo /api e repassa o sinal de cancelamento', async () => {
  const documents = [{ id: '1', originalName: 'documento.pdf' }];
  const controller = new AbortController();
  const signal = controller.signal;
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ documents }));

  assert.deepEqual(await listDocuments({ signal }), documents);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/documents');
  assert.ok(options.signal instanceof AbortSignal);
  controller.abort();
  assert.equal(options.signal.aborted, true);
});

test('envia o arquivo como multipart sem fixar Content-Type', async () => {
  const file = new File(['conteudo'], 'documento.txt');
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 201 }));

  await uploadDocument(file);

  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers, undefined);
  assert.equal(options.body.get('file').name, file.name);
  assert.equal(await options.body.get('file').text(), 'conteudo');
});

test('baixa o conteudo e codifica o identificador na URL', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('conteudo'));

  assert.equal(await (await downloadDocument('id/1')).text(), 'conteudo');
  assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/documents/id%2F1/download');
});

test('nao expoe mensagens tecnicas recebidas do backend', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ error: 'MIME invalido: /storage/JWT' }, { status: 400 }));

  await assert.rejects(uploadDocument(new File([''], 'arquivo.txt')), /Nao conseguimos enviar seu arquivo agora/);
});

test('trata respostas de erro que nao sao JSON', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Not Found', { status: 404 }));

  await assert.rejects(listDocuments(), /Nao conseguimos carregar seus arquivos agora/);
});

test('rejeita respostas de listagem fora do contrato', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ documents: {} }));

  await assert.rejects(listDocuments(), /Nao conseguimos carregar seus arquivos agora/);
});

test('limita o upload a 30 segundos e informa quando o prazo termina', async () => {
  const signal = AbortSignal.abort(new DOMException('Tempo esgotado', 'TimeoutError'));
  const timeoutMock = mock.method(AbortSignal, 'timeout', () => signal);
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.signal, signal);
    options.signal.throwIfAborted();
  });

  await assert.rejects(uploadDocument(new File(['png'], 'imagem.png')), /O envio demorou mais que o esperado/);
  assert.deepEqual(timeoutMock.mock.calls[0].arguments, [30_000]);
});

test('informa falha de conexao sem simular sucesso no upload', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });

  await assert.rejects(uploadDocument(new File(['png'], 'imagem.png')), /Nao conseguimos enviar seu arquivo agora/);
});

test('bloqueia arquivos acima de 10 MiB antes de chamar o backend', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 201 }));
  const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
  await assert.rejects(uploadDocument(file), /limite de 10 MiB/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('envia credenciais JSON e usa o token em listagem, upload e download', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    if (url === '/api/auth/login') return Response.json({ token: 'token-de-teste' });
    if (url === '/api/documents') return Response.json({ documents: [] });
    return new Response('arquivo');
  });

  await login('usuario', 'senha-de-teste');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/auth/login');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), { username: 'usuario', password: 'senha-de-teste' });
  await listDocuments();
  await uploadDocument(new File(['png'], 'imagem.png'));
  await downloadDocument('id');
  for (const call of fetchMock.mock.calls.slice(1)) {
    assert.equal(call.arguments[1].headers.Authorization, 'Bearer token-de-teste');
  }
  logout();
  await listDocuments();
  assert.equal(fetchMock.mock.calls.at(-1).arguments[1].headers, undefined);
});

test('cadastro usa a rota de autenticacao e envia JSON', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ user: { id: '1' } }, { status: 201 }));
  await registerUser('usuario', 'senha-de-teste');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/auth/register');
  assert.deepEqual(JSON.parse(options.body), { username: 'usuario', password: 'senha-de-teste' });
});

test('traduz erros de sessao sem perder o status usado pela interface', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({
    error: { code: 'UNAUTHORIZED', message: 'Autenticacao necessaria.' },
  }, { status: 401 }));
  await assert.rejects(listDocuments(), (error) => error.status === 401 && error.code === 'UNAUTHORIZED' && error.message === 'Entre novamente para continuar.');
});

test('traduz codigos de negocio para mensagens acionaveis', async () => {
  const cases = [
    [415, 'UNSUPPORTED_FILE_TYPE', /Este formato nao e permitido/],
    [413, 'LIMIT_FILE_SIZE', /ultrapassa o limite de 10 MiB/],
    [400, 'FILE_REQUIRED', /Escolha um arquivo antes de enviar/],
    [400, 'LIMIT_UNEXPECTED_FILE', /apenas um arquivo por envio/],
  ];
  for (const [status, code, message] of cases) {
    mock.method(globalThis, 'fetch', async () => Response.json({ error: { code, message: 'Detalhe interno MIME JWT' } }, { status }));
    await assert.rejects(uploadDocument(new File(['png'], 'imagem.png')), message);
  }
});

test('trata login incorreto, usuario repetido e senha curta', async () => {
  const cases = [
    [login, 401, 'INVALID_LOGIN', /Usuario ou senha incorretos/],
    [registerUser, 409, 'USERNAME_TAKEN', /ja esta em uso/],
    [registerUser, 400, 'INVALID_PASSWORD', /pelo menos 8/],
  ];
  for (const [operation, status, code, message] of cases) {
    mock.method(globalThis, 'fetch', async () => Response.json({ error: { code } }, { status }));
    await assert.rejects(operation('usuario', 'senha-de-teste'), message);
  }
});

test('erro interno ou codigo desconhecido nao vaza detalhes nem quebra o mapeamento', async () => {
  for (const [status, code] of [[500, 'INVALID_LOGIN'], [400, 'constructor'], [502, 'UNKNOWN_CODE']]) {
    mock.method(globalThis, 'fetch', async () => Response.json({ error: { code, message: 'JWT_SECRET backend /storage' } }, { status }));
    await assert.rejects(listDocuments(), /Nao conseguimos carregar seus arquivos agora/);
  }
});

test('trata JSON invalido ou login sem token com mensagem de negocio', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('<html>erro interno</html>'));
  await assert.rejects(listDocuments(), /Nao conseguimos carregar seus arquivos agora/);
  mock.method(globalThis, 'fetch', async () => Response.json({ token: null }));
  await assert.rejects(login('usuario', 'senha-de-teste'), /Nao conseguimos entrar na sua conta agora/);
});

test('falha ao ler o download tambem recebe mensagem tratada', async () => {
  mock.method(globalThis, 'fetch', async () => ({ ok: true, blob: async () => { throw new TypeError('Falha interna /storage'); } }));
  await assert.rejects(downloadDocument('id'), /Nao conseguimos baixar seu arquivo agora/);
});

test('cancelamento de listagem nao e convertido em erro para o usuario', async () => {
  const controller = new AbortController();
  controller.abort();
  mock.method(globalThis, 'fetch', async (url, options) => options.signal.throwIfAborted());
  await assert.rejects(listDocuments({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(console.warn.mock.callCount(), 0);
});

test('logs guardam somente metadados, sem senha, token ou corpo do erro', async () => {
  mock.method(globalThis, 'fetch', async (url) => url === '/api/auth/login'
    ? Response.json({ token: 'token-sigiloso' })
    : Response.json({ error: { code: 'INTERNAL_ERROR', message: 'detalhe-sigiloso' } }, { status: 500 }));
  await login('usuario', 'senha-sigilosa');
  await assert.rejects(listDocuments());
  const logs = JSON.stringify(console.warn.mock.calls.map(call => call.arguments));
  assert.match(logs, /INTERNAL_ERROR/);
  assert.doesNotMatch(logs, /token-sigiloso|senha-sigilosa|detalhe-sigiloso/);
});