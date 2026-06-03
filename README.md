# chatbot-teste

Projeto full stack de um chat com agente de IA. O repositorio esta dividido em:

- `back/`: API Node.js com Express, MySQL, JWT, Groq e testes Jest/Supertest.
- `front/agente/`: aplicacao React + TypeScript + Vite.
- `front/cypress/`: testes E2E Cypress.

Este documento foi escrito para orientar outra IA ou pessoa desenvolvedora a entender rapidamente o projeto, como rodar e quais testes existem.

## Visao Geral

O sistema permite criar conversas com um agente de IA. O frontend mostra uma interface de chat com historico local, busca, criacao, edicao e exclusao de conversas. O backend recebe mensagens pela rota `/chat`, salva conversas/mensagens no MySQL e chama a API da Groq para gerar respostas.

Em ambiente de teste (`NODE_ENV=test`), o backend evita dependencias externas:

- usa um banco em memoria no lugar do MySQL;
- retorna uma resposta fake no lugar de chamar a Groq;
- nao executa `app.listen`, apenas exporta o `app` para Supertest/Jest.

## Estrutura Principal

```text
.
├── back/
│   ├── server.js
│   ├── src/
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── config.js
│   │   ├── database.js
│   │   └── helpers.js
│   └── tests/
│       ├── acceptance.test.js
│       ├── integration.test.js
│       ├── nonfuncional.test.js
│       └── unit.test.js
└── front/
    ├── cypress.config.js
    ├── cypress/
    │   └── e2e/
    │       └── chat.cy.js
    └── agente/
        ├── src/
        │   ├── App.tsx
        │   ├── App.css
        │   └── main.tsx
        └── package.json
```

## Backend

Local: `back/`

Stack:

- Node.js CommonJS
- Express
- MySQL via `mysql2/promise`
- JWT via `jsonwebtoken`
- Senhas com `bcryptjs`
- IA via Groq usando `axios`
- Testes com Jest e Supertest

### Scripts

```powershell
cd back
npm install
npm start
npm test
```

`npm start` executa:

```powershell
node server.js
```

`npm test` executa:

```powershell
jest
```

### Variaveis de Ambiente

O backend carrega `.env` via `dotenv`. Variaveis esperadas:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=agente_ia
JWT_SECRET=troque_este_segredo_em_producao
GROQ_API_KEY=sua_chave_da_groq
```

Observacoes:

- Nao compartilhar chaves reais de `GROQ_API_KEY`.
- Para rodar em desenvolvimento normal, MySQL precisa estar ligado.
- Em testes Jest, MySQL e Groq nao sao necessarios por causa do modo `NODE_ENV=test`.

### MySQL com Docker

Comando sugerido para desenvolvimento:

```powershell
docker run --name agente-ia-mysql `
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes `
  -e MYSQL_DATABASE=agente_ia `
  -p 3306:3306 `
  -v agente_ia_mysql:/var/lib/mysql `
  -d mysql:8.0
```

Depois:

```powershell
docker start agente-ia-mysql
cd back
npm start
```

O backend cria automaticamente o banco e as tabelas se o MySQL estiver acessivel.

### Rotas da API

Principais rotas em `back/server.js`:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/health` | Verifica se a API esta operacional. |
| `POST` | `/auth/register` | Registra usuario. |
| `POST` | `/auth/login` | Autentica usuario e retorna token. |
| `GET` | `/me` | Retorna usuario autenticado. |
| `GET` | `/conversations` | Lista conversas do usuario autenticado. |
| `POST` | `/conversations` | Cria conversa para usuario autenticado. |
| `PATCH` | `/conversations/:id` | Edita titulo da conversa. |
| `DELETE` | `/conversations/:id` | Remove conversa. |
| `POST` | `/chat` | Envia mensagem ao agente e retorna resposta. |

### Comportamento Importante para Testes

`back/server.js` exporta:

```js
module.exports = { app };
```

E so inicia servidor quando nao esta em teste:

```js
if (process.env.NODE_ENV !== "test") {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  });
}
```

Isso permite que Supertest importe o `app` sem abrir porta e sem conectar no MySQL.

## Frontend

Local: `front/agente/`

Stack:

- React
- TypeScript
- Vite
- CSS puro
- Cypress instalado como dependencia de desenvolvimento do app

### Scripts

```powershell
cd front/agente
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

O Vite normalmente roda em:

```text
http://localhost:5173
```

O frontend chama o backend fixo em:

```ts
const API_URL = "http://localhost:3001";
```

### Funcionalidades do Front

Implementadas em `front/agente/src/App.tsx`:

- chat com envio de mensagem;
- historico de conversas salvo em `localStorage`;
- criacao de nova conversa;
- busca de conversas;
- edicao de titulo;
- exclusao de conversa;
- exibicao de mensagens do usuario e do agente;
- estado visual de carregamento enquanto aguarda resposta.

## Testes

O projeto tem testes no backend com Jest/Supertest e testes E2E com Cypress.

### Backend: Jest + Supertest

Local:

```text
back/tests/
```

Comando:

```powershell
cd back
npm test
```

Arquivos:

| Arquivo | Tipo | O que valida |
| --- | --- | --- |
| `unit.test.js` | Unitario | Valida uma funcao simples de mensagem vazia ou preenchida. |
| `integration.test.js` | Integracao | Faz `POST /chat` e espera status `200`; tambem mede se a resposta ocorre em menos de 5 segundos. |
| `acceptance.test.js` | Aceitacao | Faz `GET /health` e espera status `200`. |
| `nonfuncional.test.js` | Nao funcional | Faz `GET /health` e espera status `200` em menos de 1 segundo. |

Como o Jest define `NODE_ENV=test`, os testes de backend nao dependem de:

- MySQL rodando;
- Docker;
- chave real da Groq;
- internet.

### Frontend: Cypress E2E

Teste principal do projeto:

```text
front/cypress/e2e/chat.cy.js
```

Cenario coberto:

- acessa `http://localhost:5173`;
- digita uma mensagem no chat;
- clica em `Enviar`;
- verifica se a mensagem aparece na tela.

Comando sugerido para rodar o E2E a partir de `front/agente`:

```powershell
cd front/agente
npm run dev
```

Em outro terminal:

```powershell
cd front/agente
npx cypress run --config-file ../cypress.config.js --spec ../cypress/e2e/chat.cy.js
```

Para o teste E2E real, o frontend precisa estar rodando em `localhost:5173`. Se quiser validar resposta real do agente, o backend tambem precisa estar rodando em `localhost:3001`.

Observacao: existem arquivos em `front/cypress/e2e/1-getting-started` e `front/cypress/e2e/2-advanced-examples`. Eles parecem ser exemplos padrao do Cypress, nao testes principais do projeto.

## Fluxo Recomendado de Desenvolvimento

1. Subir MySQL, se for usar backend real:

```powershell
docker start agente-ia-mysql
```

2. Rodar backend:

```powershell
cd back
npm start
```

3. Rodar frontend:

```powershell
cd front/agente
npm run dev
```

4. Rodar testes do backend:

```powershell
cd back
npm test
```

5. Rodar Cypress:

```powershell
cd front/agente
npx cypress run --config-file ../cypress.config.js --spec ../cypress/e2e/chat.cy.js
```

