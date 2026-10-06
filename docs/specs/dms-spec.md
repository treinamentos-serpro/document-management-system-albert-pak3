# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web que permita a usuários autenticados enviar, listar e baixar seus documentos, com arquivos armazenados exclusivamente no filesystem local.

## 2. Escopo

### Dentro do escopo

- Cadastro e login de usuários com autenticação JWT.
- Upload de documentos por usuário autenticado.
- Listagem e download restritos aos documentos do usuário autenticado.
- Armazenamento dos arquivos em `backend/storage` usando Multer com `diskStorage`.
- Armazenamento em memória das contas e dos metadados dos documentos nesta fase.
- Frontend React para autenticação, envio, listagem e download de documentos.

### Fora do escopo

- Armazenamento de arquivos em provedores externos ou na nuvem.
- Versionamento, edição, compartilhamento ou exclusão de documentos.
- Recuperação de contas ou documentos após reinicialização do processo.
- Administração de usuários e autenticação por provedores externos.

### Premissas e limitações

- Cada conta tem um identificador único e um nome de usuário único. As contas são mantidas em memória; após reinicialização, será necessário cadastrá-las novamente.
- As senhas nunca são armazenadas em texto puro. O sistema armazena somente hashes de senha.
- Os metadados dos documentos também são mantidos em memória. Arquivos já gravados no disco podem permanecer após reinicialização, mesmo que seus metadados tenham sido perdidos.
- Todas as rotas de documentos exigem autenticação. A identidade do proprietário é obtida do token validado, nunca de um campo enviado pelo cliente.
- A API do backend usa as rotas descritas abaixo sem o prefixo `/api`. O frontend usa `/api` em desenvolvimento, encaminhado pelo proxy do Vite.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O visitante pode criar uma conta com nome de usuário e senha. Nomes de usuário duplicados são rejeitados. |
| RF-02 | O usuário pode autenticar-se com suas credenciais e receber um token JWT com prazo de expiração. Credenciais inválidas não revelam se o nome de usuário existe. |
| RF-03 | O usuário pode enviar um documento autenticado. A identidade do proprietário é definida pelo servidor com base no token. |
| RF-04 | O upload aceita somente arquivos PDF, DOCX, XLSX, PPTX e TXT, com tamanho máximo de 10 MiB por arquivo. |
| RF-05 | O usuário autenticado pode listar somente os metadados dos próprios documentos, ordenados do mais recente para o mais antigo. |
| RF-06 | O usuário autenticado pode baixar um documento próprio usando seu identificador. O arquivo é entregue como anexo com o nome original, sem expor o caminho local. |
| RF-07 | Um documento inexistente ou pertencente a outro usuário não pode ser baixado nem ter seus metadados revelados; a API responde como se o documento não existisse. |
| RF-08 | Respostas de erro da API usam um formato JSON consistente e não expõem stack traces, segredos, hashes de senha ou caminhos internos. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local em `backend/storage`, usando Multer `diskStorage`. Não usar armazenamento externo. |
| RNF-02 | Contas e metadados dos documentos são mantidos em memória nesta fase. Reiniciar o backend remove esses dados em memória; não há promessa de recuperação ou reconciliação automática dos arquivos existentes no disco. |
| RNF-03 | A configuração operacional é feita por variáveis de ambiente, incluindo porta, segredo JWT e validade do token. Segredos não devem ser versionados. |
| RNF-04 | O limite máximo é 10 MiB por arquivo. A extensão e o tipo de mídia declarado devem corresponder a um dos formatos aceitos; o nome físico no disco é gerado pelo servidor para evitar colisões e uso de caminhos fornecidos pelo cliente. |
| RNF-05 | Senhas são armazenadas somente como hashes produzidos por algoritmo apropriado para senhas. Tokens JWT são assinados com segredo configurado no ambiente e validados antes de operações protegidas. |
| RNF-06 | O backend segue Clean Architecture simples com dependências `routes -> controllers -> services -> repositories`; frontend em React usa componentes e chamadas `fetch`. |
| RNF-07 | A API informa erros com status HTTP apropriados e não deixa arquivos parciais no armazenamento local quando o upload falha. |

## 5. Modelo de dados

### Metadados do documento

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único e opaco do documento, gerado pelo servidor. |
| `originalName` | string | Nome original fornecido pelo cliente, retornado apenas como metadado seguro. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Data e hora do upload em ISO 8601, normalizadas para UTC. |
| `owner` | string | Identificador da conta proprietária, obtido do token autenticado. |

O nome físico do arquivo no disco é gerado pelo servidor e não faz parte da resposta pública. O caminho local nunca é exposto pela API.

### Conta de usuário

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único da conta, usado como `owner` nos documentos e como sujeito (`sub`) do JWT. |
| `username` | string | Nome de usuário único usado no login. |
| `passwordHash` | string | Hash da senha; nunca é retornado pela API. |

Contas e metadados são mantidos em memória nesta fase. A persistência durável de usuários e metadados não faz parte deste escopo.

## 6. Contratos de API

Os exemplos abaixo descrevem as rotas do backend. Todas as rotas de documentos exigem `Authorization: Bearer <token>`.

### `POST /auth/register`

- Entrada: JSON `{ "username": "...", "password": "..." }`.
- Sucesso: `201 Created`, JSON `{ "user": { "id": "...", "username": "..." } }`.
- Nome de usuário já utilizado: `409 Conflict`.
- Entrada inválida: `400 Bad Request`.
- A resposta nunca contém a senha ou seu hash.

### `POST /auth/login`

- Entrada: JSON `{ "username": "...", "password": "..." }`.
- Sucesso: `200 OK`, JSON `{ "token": "...", "tokenType": "Bearer", "expiresIn": "..." }`.
- Credenciais inválidas: `401 Unauthorized`, com mensagem genérica.

### `POST /upload`

- Autenticação: obrigatória.
- Entrada: `multipart/form-data`, com um arquivo no campo `file`.
- Restrições: máximo de 10 MiB; tipos aceitos PDF, DOCX, XLSX, PPTX e TXT.
- Sucesso: `201 Created`, JSON com os metadados do documento criado.
- Arquivo ausente ou formulário inválido: `400 Bad Request`.
- Arquivo acima do limite: `413 Payload Too Large`.
- Tipo ou extensão não aceitos: `415 Unsupported Media Type`.

### `GET /documents`

- Autenticação: obrigatória.
- Sucesso: `200 OK`, JSON `{ "documents": [ ... ] }`, contendo somente metadados pertencentes ao usuário autenticado, em ordem decrescente de `uploadedAt`.
- Token ausente ou inválido: `401 Unauthorized`.

### `GET /documents/:id/download`

- Autenticação: obrigatória.
- Sucesso: `200 OK` com o conteúdo binário do arquivo, `Content-Disposition: attachment` com o nome original e tipo de conteúdo correspondente ao arquivo permitido.
- Identificador inexistente, documento de outro usuário ou arquivo indisponível: `404 Not Found`.
- Token ausente ou inválido: `401 Unauthorized`.

### Formato de erro

Erros da API usam JSON no formato `{ "error": { "code": "...", "message": "..." } }`.

| Status | Uso |
| --- | --- |
| `400` | Corpo, formulário ou entrada inválida. |
| `401` | Credenciais inválidas ou token ausente, inválido ou expirado. |
| `404` | Documento inexistente, inacessível ao usuário ou arquivo local indisponível. |
| `409` | Nome de usuário já cadastrado. |
| `413` | Arquivo maior que 10 MiB. |
| `415` | Formato de arquivo não aceito. |
| `500` | Falha inesperada, sem detalhes internos na resposta. |

## 7. Decisões arquiteturais

- Backend em Node.js e Express, usando CommonJS.
- Separação simples de responsabilidades: `routes` delegam a `controllers`, que coordenam `services`; `repositories` isolam contas em memória, metadados e acesso aos arquivos locais.
- Upload local com Multer `diskStorage`, gravando em `backend/storage`; não integrar provedores externos.
- Contas e metadados em memória nesta fase, sem banco de dados.
- Autenticação própria com JWT e autorização baseada no identificador da conta autenticada.
- Frontend em React com componentes; chamadas ao backend por `fetch`, usando o proxy `/api` do Vite em desenvolvimento.
- Configurações variáveis por ambiente. `PORT` mantém o valor padrão atual `3000`; `JWT_SECRET` é obrigatório fora de testes; `JWT_EXPIRES_IN` define a validade do token.
- Nenhuma implementação de backend ou frontend é realizada por esta especificação. O código atual fornece apenas o health check no backend e um placeholder no frontend.

## 8. Plano de execução

Etapas futuras de implementação, descritas em nível funcional. Esta especificação não executa essas etapas nem define alterações em arquivos específicos.

1. Validar os requisitos, os critérios de aceitação e as configurações de ambiente para autenticação e armazenamento local.
2. Implementar cadastro, login, emissão e validação de JWT, com isolamento de dados por proprietário.
3. Implementar upload com validação de tamanho e formato, armazenamento local seguro e registro dos metadados em memória.
4. Implementar listagem e download autenticados, com respostas de erro consistentes e proteção contra acesso a documentos de outros usuários.
5. Integrar os fluxos de autenticação e documentos na interface React e validar os fluxos completos, incluindo erros e limites de upload.