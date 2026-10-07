# Document Management System com GitHub Copilot

## Frontend

```sh
npm install --prefix frontend
npm run dev --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

O cliente usa `/api`, com proxy do Vite para `http://localhost:3000`.
Inicie também o backend com `JWT_SECRET` conforme a seção abaixo. Na interface,
crie uma conta ou entre com usuário e senha para acessar os documentos. O token
fica somente em memória no navegador: ao recarregar a página, entre novamente.
O seletor mostra os formatos permitidos e o limite de 10 MiB por arquivo.

- `POST /auth/register` e `POST /auth/login`: JSON com `username` e `password`.
- `POST /upload`: multipart com o campo `file`, resposta `201` com metadados.
- `GET /documents`: objeto `{ documents: [...] }`, com `id`, `originalName`,
  `size` em bytes, `uploadedAt` em formato ISO e `owner`.
- `GET /documents/:id/download`: conteudo binario do arquivo.

As rotas de documentos exigem `Authorization: Bearer <token>`.
Respostas de erro usam `{ error: { code, message } }`.
Em producao, configure o servidor para encaminhar `/api` ao backend; o proxy
do Vite se aplica somente ao desenvolvimento.

## Workshop

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey albertpak01!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-albert-pak3/issues/1)

---

## Backend DMS

O backend usa as camadas `routes -> controllers -> services -> repositories`.
Arquivos ficam somente em `backend/storage` via Multer `diskStorage`; contas e
metadados ficam em memória. Reiniciar perde contas e metadados, mas não remove
automaticamente os arquivos já gravados.

Para iniciar, execute em `backend`:

```sh
npm install
export JWT_SECRET="$(openssl rand -hex 32)"
export JWT_EXPIRES_IN=1h
npm start
```

`JWT_SECRET` é obrigatório, não possui valor padrão e não deve ser versionado.
`JWT_EXPIRES_IN` aceita uma duração com unidade, como `1h` ou `30m` (padrão `1h`).
`PORT` tem padrão `3000`. Testes usam um segredo próprio e são executados com
`npm test`.

Cadastro e login recebem JSON com `username` (3 a 64 caracteres: letras, números,
ponto, hífen ou sublinhado) e `password` (8 a 128 caracteres no cadastro).
Senhas são armazenadas somente como hashes com salt usando `scrypt`.

```sh
curl -X POST http://localhost:3000/auth/register \
	-H 'Content-Type: application/json' \
	-d '{"username":"usuario","password":"senha-segura-123"}'
curl -X POST http://localhost:3000/auth/login \
	-H 'Content-Type: application/json' \
	-d '{"username":"usuario","password":"senha-segura-123"}'
```

O login retorna `token`, `tokenType` e `expiresIn`. Com o token em `TOKEN`:

```sh
curl http://localhost:3000/upload -H "Authorization: Bearer $TOKEN" \
	-F 'file=@documento.txt;type=text/plain'
curl http://localhost:3000/documents -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/documents/IDENTIFICADOR/download \
	-H "Authorization: Bearer $TOKEN" -OJ
```

O upload retorna os metadados com status `201`; listagem e download retornam `200`.
São aceitas imagens com MIME declarado `image/*` (PNG, JPEG, GIF, WebP, SVG,
BMP, TIFF, AVIF, HEIC e outros), além de PDF, DOCX, XLSX, PPTX e TXT com extensão
e MIME correspondentes. O limite é de 10 MiB por arquivo, um arquivo por envio.
Imagens são servidas como anexos para download, sem visualização inline.
Áudio e vídeo ainda não são aceitos. Essa validação não inspeciona o conteúdo e não
substitui verificação antivírus. O proprietário vem do JWT, nunca do formulário.
Listagem e download são limitados ao próprio usuário; documentos de outro usuário
e arquivos indisponíveis retornam `404`. Os erros usam
`{ "error": { "code": "...", "message": "..." } }`.

As rotas do backend não possuem prefixo `/api`; esse prefixo é usado pelo proxy
do frontend em desenvolvimento. `GET /health` continua público.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)

