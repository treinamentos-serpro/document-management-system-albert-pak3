const API_PREFIX = '/api';
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
let accessToken = '';

const failureMessages = {
  upload: 'Nao conseguimos enviar seu arquivo agora. Tente novamente.',
  list: 'Nao conseguimos carregar seus arquivos agora. Tente novamente.',
  download: 'Nao conseguimos baixar seu arquivo agora. Tente novamente.',
  login: 'Nao conseguimos entrar na sua conta agora. Tente novamente.',
  register: 'Nao conseguimos criar sua conta agora. Tente novamente.',
};

const errorMessages = {
  INVALID_CREDENTIALS: 'Confira o nome de usuario e a senha informados.',
  INVALID_PASSWORD: 'Escolha uma senha com pelo menos 8 e no maximo 128 caracteres.',
  USERNAME_TAKEN: 'Este nome de usuario ja esta em uso. Escolha outro.',
  INVALID_LOGIN: 'Usuario ou senha incorretos. Confira os dados e tente novamente.',
  UNAUTHORIZED: 'Entre novamente para continuar.',
  FILE_REQUIRED: 'Escolha um arquivo antes de enviar.',
  UNSUPPORTED_FILE_TYPE: 'Este formato nao e permitido. Confira os formatos aceitos abaixo.',
  LIMIT_FILE_SIZE: 'Este arquivo ultrapassa o limite de 10 MiB. Escolha um arquivo menor.',
  LIMIT_UNEXPECTED_FILE: 'Selecione apenas um arquivo por envio.',
  DOCUMENT_NOT_FOUND: 'Este arquivo nao esta mais disponivel.',
};

function userError(operation, { status, code, cause } = {}) {
  let message = failureMessages[operation];
  if (!status || status < 500) {
    if (Object.hasOwn(errorMessages, code)) message = errorMessages[code];
    else if (status === 401) message = operation === 'login' ? errorMessages.INVALID_LOGIN : errorMessages.UNAUTHORIZED;
    else if (status === 413 && operation === 'upload') message = errorMessages.LIMIT_FILE_SIZE;
    else if (status === 415 && operation === 'upload') message = errorMessages.UNSUPPORTED_FILE_TYPE;
    else if (status === 404 && operation === 'download') message = errorMessages.DOCUMENT_NOT_FOUND;
  }
  if (cause?.name === 'TimeoutError') {
    message = operation === 'upload'
      ? 'O envio demorou mais que o esperado. Tente novamente.'
      : 'Esta operacao demorou mais que o esperado. Tente novamente.';
  }
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (cause) {
    console.warn('Falha na operacao de arquivos ou conta.', {
      operation,
      status,
      code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'UNKNOWN_ERROR',
      reason: cause.name,
    });
  }
  return error;
}

async function request(path, options, operation, readResponse = () => undefined) {
  const timeoutSignal = AbortSignal.timeout(30_000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const requestOptions = { ...options, signal };
  if (accessToken) {
    requestOptions.headers = { ...options?.headers, Authorization: `Bearer ${accessToken}` };
  }
  try {
    const response = await fetch(`${API_PREFIX}${path}`, requestOptions);
    if (!response.ok) {
      let body;
      try {
        body = await response.json();
      } catch (error) {
        if (signal.aborted) throw error;
      }
      const error = new Error('HTTP_ERROR');
      error.status = response.status;
      error.code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
      throw error;
    }
    return await readResponse(response);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    const cause = signal.aborted ? signal.reason : error;
    throw userError(operation, { status: error.status, code: error.code, cause });
  }
}

export async function listDocuments({ signal } = {}) {
  return request('/documents', { signal }, 'list', async (response) => {
    const body = await response.json();
    if (!Array.isArray(body?.documents)) throw new Error('INVALID_RESPONSE');
    return body.documents;
  });
}

export async function uploadDocument(file) {
  if (file.size > MAX_UPLOAD_SIZE) {
    throw userError('upload', { code: 'LIMIT_FILE_SIZE' });
  }
  const body = new FormData();
  body.append('file', file);
  await request('/upload', { method: 'POST', body }, 'upload');
}

export async function downloadDocument(id) {
  return request(
    `/documents/${encodeURIComponent(id)}/download`,
    undefined,
    'download',
    (response) => response.blob(),
  );
}

export async function registerUser(username, password) {
  await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }, 'register');
}

export async function login(username, password) {
  const token = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }, 'login', async (response) => {
    const body = await response.json();
    if (typeof body?.token !== 'string' || !body.token) throw new Error('INVALID_RESPONSE');
    return body.token;
  });
  accessToken = token;
}

export function logout() {
  accessToken = '';
}